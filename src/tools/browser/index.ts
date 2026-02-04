/**
 * Sara Tools - Browser Module
 * 
 * Secure browser navigation for web research.
 */

export * from './network-jail.js';
export * from './content-filter.js';
export * from './browser-executor.js';

// Convenience re-exports
export {
    NetworkJail,
    createNetworkJail,
    createStrictNetworkJail,
    validateUrl,
    PRIVATE_NETWORKS,
    SECURE_DNS_SERVERS,
    DEFAULT_NETWORK_JAIL_CONFIG,
} from './network-jail.js';

export {
    ContentFilter,
    createContentFilter,
    loadDefaultPolicy,
} from './content-filter.js';

export {
    SafeBrowserExecutor,
    createBrowserExecutor,
    createTestBrowserExecutor,
    DEFAULT_BROWSER_EXECUTOR_CONFIG,
} from './browser-executor.js';

export type {
    NetworkJailConfig,
    DockerNetworkConfig,
} from './network-jail.js';

export type {
    BrowserPolicy,
    UrlCheckResult,
    ContentFilterResult,
} from './content-filter.js';

export type {
    BrowserSearchResult,
    NavigationOptions,
    SearchOptions,
    BrowserExecutorConfig,
} from './browser-executor.js';
