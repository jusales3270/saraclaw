import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface SyncMetadata {
  source: string;
  lastSyncTime: Date;
  totalSynced: number;
  lastError?: string;
}

/**
 * Manages incremental sync for data sources (sql.js version)
 */
export class IncrementalSync {
  private db: Database | null = null;
  private dbPath: string;
  private SQL: any;

  constructor(dbPath = '/home/node/.saraclaw/sync-metadata.db') {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) { }
    }
    this.dbPath = dbPath;
  }

  private async init() {
    if (this.db) return;

    this.SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const filebuffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(filebuffer);
    } else {
      this.db = new this.SQL.Database();
      this.initSchema();
      this.save();
    }
  }

  private initSchema() {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        source TEXT PRIMARY KEY,
        last_sync_time DATETIME NOT NULL,
        total_synced INTEGER DEFAULT 0,
        last_error TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        sync_time DATETIME NOT NULL,
        items_synced INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        error TEXT,
        duration_ms INTEGER
      );
    `);
  }

  private save() {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /**
   * Get last sync time for a source
   */
  async getLastSyncTime(source: string): Promise<Date | null> {
    await this.init();
    if (!this.db) throw new Error('DB init failed');

    const stmt = this.db.prepare(`
      SELECT last_sync_time
      FROM sync_metadata
      WHERE source = :source
    `);
    const result = stmt.getAsObject({ ':source': source }) as { last_sync_time: string };
    stmt.free();

    return result && result.last_sync_time ? new Date(result.last_sync_time) : null;
  }

  /**
   * Update sync metadata
   */
  async updateSyncTime(source: string, syncTime: Date, itemsSynced: number) {
    await this.init();
    if (!this.db) throw new Error('DB init failed');

    this.db.run(`
      INSERT INTO sync_metadata (source, last_sync_time, total_synced)
      VALUES (?, ?, ?)
      ON CONFLICT(source) DO UPDATE SET
        last_sync_time = excluded.last_sync_time,
        total_synced = total_synced + excluded.total_synced,
        updated_at = CURRENT_TIMESTAMP
    `, [source, syncTime.toISOString(), itemsSynced]);

    this.save();
  }

  /**
   * Record sync attempt in history
   */
  async recordSync(
    source: string,
    syncTime: Date,
    itemsSynced: number,
    success: boolean,
    durationMs: number,
    error?: string
  ) {
    await this.init();
    if (!this.db) throw new Error('DB init failed');

    this.db.run(`
      INSERT INTO sync_history (
        source, sync_time, items_synced, success, error, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      source,
      syncTime.toISOString(),
      itemsSynced,
      success ? 1 : 0,
      error || null,
      durationMs
    ]);

    this.save();
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(source: string) {
    await this.init();
    if (!this.db) throw new Error('DB init failed');

    const stmt = this.db.prepare(`
      SELECT 
        source, 
        last_sync_time as lastSyncTime, 
        total_synced as totalSynced, 
        last_error as lastError 
      FROM sync_metadata 
      WHERE source = :source
    `);
    const metadata = stmt.getAsObject({ ':source': source }) as unknown as SyncMetadata;
    // sql.js returns an empty object {} if no row found, check if a key exists
    const hasData = metadata && Object.keys(metadata).length > 0;

    stmt.free();

    const result = this.db.exec(`
      SELECT 
        source, 
        sync_time as syncTime,
        items_synced as itemsSynced,
        success,
        error,
        duration_ms as durationMs
      FROM sync_history
      WHERE source = '${source}'
      ORDER BY sync_time DESC
      LIMIT 10
    `);

    let history: any[] = [];
    if (result.length > 0) {
      const columns = result[0].columns;
      const values = result[0].values;
      history = values.map((row: any[]) => {
        const obj: any = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj;
      });
    }

    return { metadata: hasData ? metadata : undefined, history };
  }

  /**
   * Check if sync is needed (based on time elapsed)
   */
  async shouldSync(source: string, intervalMinutes = 60): Promise<boolean> {
    const lastSync = await this.getLastSyncTime(source);

    if (!lastSync) {
      return true; // Never synced
    }

    const elapsed = Date.now() - lastSync.getTime();
    const threshold = intervalMinutes * 60 * 1000;

    return elapsed >= threshold;
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
