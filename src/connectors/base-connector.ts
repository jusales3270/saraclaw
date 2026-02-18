import { VectorStore } from '../../packages/sara-memory/src/vector-store.js';
import { IncrementalSync } from '../../packages/sara-memory/src/incremental-sync.js';

export interface SyncResult {
    itemsSynced: number;
    success: boolean;
    error?: string;
}

export abstract class BaseConnector {
    constructor(
        protected sourceName: string,
        protected vectorStore: VectorStore,
        protected incrementalSync: IncrementalSync
    ) { }

    /**
     * Fetch data from the source (since last sync)
     */
    abstract fetchData(): Promise<any[]>;

    /**
     * Transform raw data into text for embedding
     */
    abstract transformData(data: any): Promise<string>;

    /**
     * Prepare metadata for the vector store
     */
    abstract prepareMetadata(data: any): Promise<any>;

    /**
     * Validate data item before processing
     */
    abstract validateData(data: any): Promise<boolean>;

    /**
     * Perform the synchronization process
     */
    async sync(): Promise<SyncResult> {
        const startTime = Date.now();
        let itemsSynced = 0;

        try {
            console.log(`[${this.sourceName}] Starting sync...`);

            // 1. Fetch data
            const items = await this.fetchData();
            console.log(`[${this.sourceName}] Fetched ${items.length} items`);

            if (items.length === 0) {
                return { itemsSynced: 0, success: true };
            }

            // 2. Process items
            for (const item of items) {
                try {
                    // Validate
                    const isValid = await this.validateData(item);
                    if (!isValid) continue;

                    // Transform
                    const content = await this.transformData(item);
                    if (!content) continue;

                    // Metadata
                    const metadata = await this.prepareMetadata(item);

                    // Add to Vector Store
                    // Note: VectorStore.add handles deduplication via content hash
                    await this.vectorStore.add(content, metadata);
                    itemsSynced++;

                } catch (err) {
                    console.error(`[${this.sourceName}] Error processing item:`, err);
                }
            }

            // 3. Update sync state
            const syncTime = new Date();
            await this.incrementalSync.updateSyncTime(this.sourceName, syncTime, itemsSynced);

            // 4. Record history
            await this.incrementalSync.recordSync(
                this.sourceName,
                syncTime,
                itemsSynced,
                true,
                Date.now() - startTime
            );

            console.log(`[${this.sourceName}] Sync complete. Items: ${itemsSynced}`);

            return { itemsSynced, success: true };

        } catch (error: any) {
            console.error(`[${this.sourceName}] Sync failed:`, error);

            // Record failure
            await this.incrementalSync.recordSync(
                this.sourceName,
                new Date(),
                itemsSynced,
                false,
                Date.now() - startTime,
                error.message || String(error)
            );

            return {
                itemsSynced,
                success: false,
                error: error.message || String(error)
            };
        }
    }
}
