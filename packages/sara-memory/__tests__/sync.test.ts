import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IncrementalSync } from '../src/incremental-sync.js';
import fs from 'fs';
import path from 'path';

describe('Incremental Sync (sql.js)', () => {
    let syncManager: IncrementalSync;
    const testDbPath = path.join(process.cwd(), 'test-sync.db');

    beforeEach(() => {
        if (fs.existsSync(testDbPath)) {
            try { fs.unlinkSync(testDbPath); } catch (e) { }
        }

        syncManager = new IncrementalSync(testDbPath);
    });

    afterEach(() => {
        syncManager.close();

        if (fs.existsSync(testDbPath)) {
            try { fs.unlinkSync(testDbPath); } catch (e) { }
        }
    });

    it('should return null for never synced source', async () => {
        const time = await syncManager.getLastSyncTime('never-synced');
        expect(time).toBeNull();
    });

    it('should update and retrieve sync time', async () => {
        const now = new Date();
        await syncManager.updateSyncTime('test-source', now, 10);

        const time = await syncManager.getLastSyncTime('test-source');
        expect(time).toEqual(now);

        const stats = await syncManager.getSyncStats('test-source');
        expect(stats.metadata?.totalSynced).toBe(10);
    });

    it('should determine if sync is needed', async () => {
        // Should sync if never synced
        expect(await syncManager.shouldSync('test-source', 60)).toBe(true);

        const now = new Date();
        await syncManager.updateSyncTime('test-source', now, 0);

        // Shouldn't sync right after
        expect(await syncManager.shouldSync('test-source', 60)).toBe(false);
    });

    it('should record sync history', async () => {
        const now = new Date();
        await syncManager.recordSync('test-source', now, 5, true, 100, undefined);

        const stats = await syncManager.getSyncStats('test-source');
        expect(stats.history).toHaveLength(1);
        // sql.js might return 1/0 for boolean columns (sqlite standard)
        expect(stats.history[0].success).toBeTruthy();
        expect(stats.history[0].itemsSynced).toBe(5);
    });
});
