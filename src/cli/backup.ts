import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import archiver from 'archiver';
import crypto from 'crypto';

export interface BackupManifest {
    version: string;
    createdAt: string;
    files: string[];
    saraVersion: string;
    checksums: Record<string, string>;
}

export interface BackupResult {
    success: boolean;
    outputPath: string;
    sizeBytes: number;
    filesIncluded: number;
    duration: number;
    manifest: BackupManifest;
}

const getDataDir = () => process.env.SARA_DATA_DIR || '/home/node/.saraclaw';
const BACKUP_FILES = [
    'chat-history.db',
    'usage.db',
    'openaugi.db',
    'sync-metadata.db',
    'oauth-tokens.db',
    'config.json'
];

/**
 * Create a backup of all Sara data
 */
export async function backup(outputPath?: string): Promise<BackupResult> {
    const startTime = Date.now();

    // Default output path: ~/sara-backups/sara-YYYY-MM-DD-HHmm.tar.gz
    const timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '');

    const defaultPath = path.join(
        process.env.HOME || '~',
        'sara-backups',
        `sara-${timestamp}.tar.gz`
    );

    const finalOutputPath = outputPath || defaultPath;

    // Ensure output directory exists
    const outputDir = path.dirname(finalOutputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    console.log('[Backup] Starting backup...');
    console.log(`[Backup] Output: ${finalOutputPath}`);

    // Collect files to backup
    const filesToBackup = BACKUP_FILES
        .map(file => path.join(getDataDir(), file))
        .filter(file => fs.existsSync(file));

    // Include security logs
    const logsDir = path.join(getDataDir(), 'security-logs');
    if (fs.existsSync(logsDir)) {
        const logFiles = fs.readdirSync(logsDir)
            .map(file => path.join(logsDir, file));
        filesToBackup.push(...logFiles);
    }

    // Include journals
    const journalsDir = path.join(getDataDir(), 'journals');
    if (fs.existsSync(journalsDir)) {
        const journalFiles = fs.readdirSync(journalsDir)
            .map(file => path.join(journalsDir, file));
        filesToBackup.push(...journalFiles);
    }

    console.log(`[Backup] Found ${filesToBackup.length} files to backup`);

    // Calculate checksums
    const checksums: Record<string, string> = {};
    for (const file of filesToBackup) {
        const hash = calculateChecksum(file);
        checksums[path.basename(file)] = hash;
    }

    // Create manifest
    const manifest: BackupManifest = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        files: filesToBackup.map(f => path.basename(f)),
        saraVersion: process.env.SARA_VERSION || '1.0.0',
        checksums
    };

    // Write manifest temporarily
    const manifestPath = path.join(getDataDir(), 'backup-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    filesToBackup.push(manifestPath);

    // Create archive
    await createArchive(filesToBackup, finalOutputPath);

    // Clean up temp manifest
    fs.unlinkSync(manifestPath);

    const sizeBytes = fs.statSync(finalOutputPath).size;
    const duration = Date.now() - startTime;

    console.log(`[Backup] Complete!`);
    console.log(`[Backup] Size: ${formatBytes(sizeBytes)}`);
    console.log(`[Backup] Duration: ${duration}ms`);

    return {
        success: true,
        outputPath: finalOutputPath,
        sizeBytes,
        filesIncluded: filesToBackup.length,
        duration,
        manifest
    };
}

/**
 * Restore from backup
 */
export async function restore(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
    }

    console.log('[Restore] Starting restore...');
    console.log(`[Restore] Source: ${backupPath}`);

    // Create restore temp directory
    const restoreDir = path.join(getDataDir(), 'restore-tmp');
    fs.mkdirSync(restoreDir, { recursive: true });

    try {
        // Extract archive
        console.log('[Restore] Extracting archive...');
        // Use proper tar command based on OS, or use archiver extraction if possible. 
        // Since we're in node environment, we can use 'tar' command if available, or a library. 
        // The user code uses execSync tar.

        // Check if tar exists (should on mostly all systems, maybe not pure windows without tools)
        // For wider compatibility we might want to use a library like 'tar' (npm package) but user asked for 'archiver'.
        // `tar -xzf` assumes linux/mac or windows with git bash/wsl.
        // I will use `execSync('tar ...')` as requested but it might fail on vanilla windows commmand prompt if tar is not in path.
        // Windows 10+ has tar.

        try {
            execSync(`tar -xzf "${backupPath}" -C "${restoreDir}"`);
        } catch (e) {
            console.error('Failed to run tar command. Ensure tar is available.', e);
            throw e;
        }

        // Read manifest
        const manifestPath = path.join(restoreDir, 'backup-manifest.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error('Backup manifest not found - archive may be corrupted or structure is flattened.');
        }

        const manifest: BackupManifest = JSON.parse(
            fs.readFileSync(manifestPath, 'utf-8')
        );

        console.log(`[Restore] Backup from: ${manifest.createdAt}`);
        console.log(`[Restore] Sara version: ${manifest.saraVersion}`);

        // Verify checksums
        console.log('[Restore] Verifying checksums...');

        for (const [filename, expectedHash] of Object.entries(manifest.checksums)) {
            // Note: files might be in restoreDir directly or subdirectories depending on how they were archived.
            // backup() uses archive.file(file, { name: path.basename(file) }) so they are flat.
            const filePath = path.join(restoreDir, filename);

            if (fs.existsSync(filePath)) {
                const actualHash = calculateChecksum(filePath);

                if (actualHash !== expectedHash) {
                    throw new Error(`Checksum mismatch for ${filename} - file may be corrupted`);
                }
            } else {
                console.warn(`[Restore] Warning: file ${filename} in manifest not found (maybe optional?)`);
            }
        }

        console.log('[Restore] Checksums verified ✅');

        // Backup current data before restoring
        const preRestoreBackup = path.join(
            path.dirname(backupPath),
            `pre-restore-${Date.now()}.tar.gz`
        );

        console.log('[Restore] Creating pre-restore backup...');
        // Don't fail restore if pre-backup fails? Better to fail.
        await backup(preRestoreBackup);

        // Restore files
        console.log('[Restore] Restoring files...');

        for (const filename of manifest.files) {
            if (filename === 'backup-manifest.json') continue;

            const sourcePath = path.join(restoreDir, filename);
            const destPath = path.join(getDataDir(), filename);

            if (fs.existsSync(sourcePath)) {
                // Ensure destination directory exists
                fs.mkdirSync(path.dirname(destPath), { recursive: true });

                // Copy using stream/copyFile
                fs.copyFileSync(sourcePath, destPath);
                console.log(`[Restore] Restored: ${filename}`);
            }
        }

        console.log('[Restore] Restore complete! ✅');
        console.log(`[Restore] Pre-restore backup saved at: ${preRestoreBackup}`);

    } finally {
        // Clean up temp directory
        try {
            fs.rmSync(restoreDir, { recursive: true, force: true });
        } catch (e) {
            console.warn('Failed to cleanup restore temp dir', e);
        }
    }
}

/**
 * List available backups
 */
export function listBackups(backupDir?: string): BackupManifest[] {
    const dir = backupDir || path.join(process.env.HOME || '~', 'sara-backups');

    if (!fs.existsSync(dir)) {
        return [];
    }

    const backupFiles = fs.readdirSync(dir)
        .filter(f => f.endsWith('.tar.gz'))
        .sort()
        .reverse();

    const manifests: BackupManifest[] = [];

    for (const file of backupFiles) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        // Add basic info without extracting (extracting is too heavy for list)
        // Just metadata from filename and file stats
        manifests.push({
            version: '1.0',
            createdAt: stat.mtime.toISOString(),
            files: [], // can't know without peeking
            saraVersion: 'unknown',
            checksums: {}
        });
    }

    return manifests;
}

/**
 * Create tar.gz archive
 */
function createArchive(files: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('tar', { gzip: true });

        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);

        for (const file of files) {
            archive.file(file, { name: path.basename(file) });
        }

        archive.finalize();
    });
}

/**
 * Calculate file checksum
 */
function calculateChecksum(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
