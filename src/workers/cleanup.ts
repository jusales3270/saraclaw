import fs from 'fs';
import path from 'path';

/**
 * M9 FIX: Periodic cleanup of temp uploads
 * Removing files older than 1 hour from uploads directory
 */
export function startTempCleanupJob(intervalMs = 60 * 60 * 1000) {
    const uploadDir = process.env.SARA_UPLOAD_TEMP_DIR || '/tmp/sara-uploads/';

    if (!fs.existsSync(uploadDir)) {
        return; // Nothing to clean
    }

    console.log(`[Cleanup] Starting temp file cleaner for ${uploadDir}`);

    setInterval(() => {
        try {
            const files = fs.readdirSync(uploadDir);
            const now = Date.now();
            let deleted = 0;

            for (const file of files) {
                const filePath = path.join(uploadDir, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                // Delete if older than 1 hour
                if (age > 3600000) {
                    fs.unlinkSync(filePath);
                    deleted++;
                }
            }
            if (deleted > 0) {
                console.log(`[Cleanup] Removed ${deleted} stale temp files.`);
            }
        } catch (error) {
            console.error('[Cleanup] Error during cleanup:', error);
        }
    }, intervalMs);
}
