console.log('SyncScheduler placeholder');

import { BaseConnector } from './base-connector.js';
import { IncrementalSync } from '../../packages/sara-memory/src/incremental-sync.js';

export class SyncScheduler {
    private connectors: BaseConnector[] = [];
    private syncManager: IncrementalSync;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(syncManager?: IncrementalSync) {
        this.syncManager = syncManager || new IncrementalSync();
    }

    /**
     * Register a connector to be scheduled
     */
    registerConnector(connector: BaseConnector) {
        this.connectors.push(connector);
        console.log(`[SyncScheduler] Registered connector: ${connector.getName()}`);
    }

    /**
     * Start the scheduler
     * @param intervalMinutes Check interval in minutes
     */
    start(intervalMinutes = 60) {
        if (this.isRunning) return;

        this.isRunning = true;
        console.log(`[SyncScheduler] Started with ${intervalMinutes}m interval`);

        // Initial run
        this.runSync();

        // Schedule
        this.intervalId = setInterval(() => {
            this.runSync();
        }, intervalMinutes * 60 * 1000);
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[SyncScheduler] Stopped');
    }

    /**
     * Run synchronization for all connectors if needed
     */
    private async runSync() {
        console.log('[SyncScheduler] Checking for updates...');

        for (const connector of this.connectors) {
            const source = connector.getId();

            if (this.syncManager.shouldSync(source)) {
                console.log(`[SyncScheduler] Syncing ${connector.getName()}...`);
                const startTime = Date.now();

                try {
                    const result = await connector.sync();
                    const duration = Date.now() - startTime;

                    this.syncManager.updateSyncTime(source, new Date(), result.itemsSynced);
                    this.syncManager.recordSync(
                        source,
                        new Date(),
                        result.itemsSynced,
                        result.success,
                        duration,
                        result.error
                    );

                    console.log(`[SyncScheduler] Synced ${connector.getName()}: ${result.itemsSynced} items`);
                } catch (error: any) {
                    const duration = Date.now() - startTime;
                    console.error(`[SyncScheduler] Error syncing ${connector.getName()}:`, error);

                    this.syncManager.recordSync(
                        source,
                        new Date(),
                        0,
                        false,
                        duration,
                        error.message
                    );
                }
            }
        }
    }
}
