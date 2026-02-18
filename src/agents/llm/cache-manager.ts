
import crypto from 'crypto';

/**
 * Manages prompt caching for Kimi and Opus
 */
export class CacheManager {
    private cache = new Map<string, string>();

    /**
     * Get cached hash for a key
     */
    get(key: string): string | undefined {
        return this.cache.get(key);
    }

    /**
     * Set cached hash
     */
    set(key: string, hash: string): void {
        this.cache.set(key, hash);
    }

    /**
     * Generate hash of content
     */
    hash(content: string): string {
        return crypto
            .createHash('sha256')
            .update(content)
            .digest('hex')
            .substring(0, 16); // First 16 chars
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
    }
}
