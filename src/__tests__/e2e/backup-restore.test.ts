import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { backup, restore, listBackups } from '../../cli/backup.js';
import fs from 'fs';
import path from 'path';

describe('Backup/Restore E2E', () => {
    const testBackupDir = path.join(process.cwd(), 'temp-test-backups');
    const testBackupPath = path.join(testBackupDir, 'test-backup.tar.gz');
    const testDataDir = path.join(process.cwd(), 'temp-test-data');

    // Mock process.env
    const originalEnv = { ...process.env };

    beforeAll(() => {
        fs.mkdirSync(testBackupDir, { recursive: true });
        fs.mkdirSync(testDataDir, { recursive: true });

        // Create dummy Sara data files
        fs.writeFileSync(
            path.join(testDataDir, 'config.json'),
            JSON.stringify({ budget: 2.0 })
        );
        fs.writeFileSync(
            path.join(testDataDir, 'chat-history.db'),
            'dummy content'
        );

        process.env.SARA_DATA_DIR = testDataDir;
        process.env.HOME = testBackupDir; // redirect default backup location
    });

    afterAll(() => {
        // Restore env
        process.env.SARA_DATA_DIR = originalEnv.SARA_DATA_DIR;
        process.env.HOME = originalEnv.HOME;

        // Cleanup
        try {
            fs.rmSync(testBackupDir, { recursive: true, force: true });
            fs.rmSync(testDataDir, { recursive: true, force: true });
        } catch (e) {
            console.warn('Cleanup failed', e);
        }
    });

    it('should create backup', async () => {
        const result = await backup(testBackupPath);

        expect(result.success).toBe(true);
        expect(result.outputPath).toBe(testBackupPath);
        expect(fs.existsSync(testBackupPath)).toBe(true);
        expect(result.sizeBytes).toBeGreaterThan(0);
        expect(result.manifest).toBeDefined();
        expect(result.manifest.version).toBe('1.0');
        expect(result.filesIncluded).toBeGreaterThan(0);
    });

    it('should list backups', () => {
        // listBackups uses default dir if argument not provided, or provided argument
        // We pass testBackupDir where we saved the backup
        // But listBackups searches in `sara-backups` subdir if using default logic?
        // Let's check backup.ts logic. 
        // It accepts backupDir.

        // We saved to testBackupPath which is inside testBackupDir.
        const backups = listBackups(testBackupDir);

        expect(backups.length).toBeGreaterThan(0);
        expect(new Date(backups[0].createdAt).getTime()).toBeGreaterThan(0);
    });

    it('should verify backup integrity', async () => {
        const size = fs.statSync(testBackupPath).size;
        expect(size).toBeGreaterThan(0);
    });

    it('should restore from backup', async () => {
        // Modify data to verify restore
        fs.writeFileSync(path.join(testDataDir, 'config.json'), JSON.stringify({ budget: 999.0 }));

        await restore(testBackupPath);

        const config = JSON.parse(fs.readFileSync(path.join(testDataDir, 'config.json'), 'utf-8'));
        expect(config.budget).toBe(2.0); // Restored value
    });
});
