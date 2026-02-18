
import Database from 'better-sqlite3';

export interface UsageRecord {
  model: string;
  feature: string;                   // 🆕 echo, whisper, cua, etc.
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;              // 🆕 Cached input tokens
  cost: number;
  latency: number;
  cached: boolean;
  timestamp?: Date;
}

export interface FeatureStats {
  feature: string;
  requests: number;
  totalCost: number;
  avgLatency: number;
  cacheHitRate: number;              // 🆕 % of requests with cache
}

export class CostTracker {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = process.env.NODE_ENV === 'test' ? ':memory:' : './usage.db';
    this.db = new Database(dbPath || defaultPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model TEXT NOT NULL,
        feature TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cached_tokens INTEGER DEFAULT 0,
        cost REAL NOT NULL,
        latency INTEGER NOT NULL,
        cached BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_timestamp ON usage(timestamp);
      CREATE INDEX IF NOT EXISTS idx_model ON usage(model);
      CREATE INDEX IF NOT EXISTS idx_feature ON usage(feature);
    `);
  }

  async track(record: UsageRecord) {
    this.db.prepare(`
      INSERT INTO usage (
        model, feature, input_tokens, output_tokens, 
        cached_tokens, cost, latency, cached
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.model,
      record.feature,
      record.inputTokens,
      record.outputTokens,
      record.cachedTokens,
      record.cost,
      record.latency,
      record.cached ? 1 : 0
    );
  }

  getTodayCost(): number {
    const result = this.db.prepare(`
      SELECT SUM(cost) as total
      FROM usage
      WHERE DATE(timestamp) = DATE('now')
    `).get() as { total: number | null };

    return result?.total || 0;
  }

  /**
   * 🆕 Get breakdown by feature
   */
  getFeatureBreakdown(date: string): FeatureStats[] {
    const results = this.db.prepare(`
      SELECT 
        feature,
        COUNT(*) as requests,
        SUM(cost) as total_cost,
        AVG(latency) as avg_latency,
        (SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as cache_hit_rate
      FROM usage
      WHERE DATE(timestamp) = ?
      GROUP BY feature
      ORDER BY total_cost DESC
    `).all(date) as FeatureStats[];

    return results;
  }

  /**
   * 🆕 Get model usage comparison
   */
  getModelComparison(date: string) {
    return this.db.prepare(`
      SELECT 
        model,
        COUNT(*) as requests,
        SUM(cost) as total_cost,
        AVG(latency) as avg_latency,
        SUM(input_tokens + output_tokens) as total_tokens
      FROM usage
      WHERE DATE(timestamp) = ?
      GROUP BY model
    `).all(date);
  }

  /**
   * 🆕 Projected end-of-month cost
   */
  getMonthlyProjection(): number {
    const result = this.db.prepare(`
      SELECT AVG(daily_cost) as avg_daily
      FROM (
        SELECT DATE(timestamp) as date, SUM(cost) as daily_cost
        FROM usage
        WHERE timestamp >= DATE('now', 'start of month')
        GROUP BY DATE(timestamp)
      )
    `).get() as { avg_daily: number | null };

    const avgDaily = result.avg_daily || 0;
    const daysInMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0
    ).getDate();

    return avgDaily * daysInMonth;
  }
}
