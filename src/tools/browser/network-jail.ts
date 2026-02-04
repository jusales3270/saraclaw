/**
 * Sara Tools - Network Jail
 * 
 * Generates network isolation rules for sandboxed containers.
 * Blocks access to internal networks (LAN) and enforces secure DNS.
 * 
 * This is a critical security layer - Sara should NEVER access the
 * operator's internal network (router, NAS, other devices).
 */

// ============================================
// TYPES
// ============================================

/**
 * Network isolation configuration
 */
export interface NetworkJailConfig {
    /** CIDR ranges to block (internal networks) */
    blockedCIDRs: string[];

    /** DNS servers to use (should be external/secure) */
    dnsServers: string[];

    /** Allowed outbound ports */
    allowedPorts: number[];

    /** Block all outbound except allowed ports */
    defaultDeny: boolean;

    /** Allow ICMP (ping) */
    allowICMP: boolean;

    /** Block access to Docker host (169.254.169.254, etc) */
    blockDockerMeta: boolean;

    /** Log blocked connections */
    logBlocked: boolean;
}

/**
 * Docker network configuration for container creation
 */
export interface DockerNetworkConfig {
    /** iptables rules to apply */
    iptablesRules: string[];

    /** DNS configuration */
    dns: string[];

    /** Network mode */
    networkMode: 'bridge' | 'none';

    /** Extra docker run arguments */
    dockerArgs: string[];
}

// ============================================
// CONSTANTS
// ============================================

/** Private network ranges (RFC 1918 + IPv6 equivalents) */
export const PRIVATE_NETWORKS = [
    // IPv4 Private
    '10.0.0.0/8',        // Class A private
    '172.16.0.0/12',     // Class B private
    '192.168.0.0/16',    // Class C private
    '127.0.0.0/8',       // Loopback IPv4
    '169.254.0.0/16',    // Link-local (includes Docker metadata)
    // IPv6 Private & Loopback
    '::1/128',           // Loopback IPv6 (CRITICAL!)
    'fc00::/7',          // IPv6 unique local
    'fe80::/10',         // IPv6 link-local
    'fd00::/8',          // IPv6 private
];

/** Docker metadata IPs to block */
export const DOCKER_METADATA_IPS = [
    '169.254.169.254',   // AWS/GCP metadata
    '169.254.170.2',     // ECS credentials
];

/** Secure DNS servers (public, no logging) */
export const SECURE_DNS_SERVERS = [
    '1.1.1.1',           // Cloudflare (privacy-focused)
    '1.0.0.1',           // Cloudflare secondary
    '9.9.9.9',           // Quad9 (malware blocking)
    '8.8.8.8',           // Google (fallback)
];

/** Standard web ports */
export const WEB_PORTS = [80, 443];

/** Default jail configuration */
export const DEFAULT_NETWORK_JAIL_CONFIG: NetworkJailConfig = {
    blockedCIDRs: PRIVATE_NETWORKS,
    dnsServers: SECURE_DNS_SERVERS.slice(0, 2),
    allowedPorts: WEB_PORTS,
    defaultDeny: false,
    allowICMP: false,
    blockDockerMeta: true,
    logBlocked: true,
};

// ============================================
// JAIL RULES GENERATOR
// ============================================

/**
 * Network Jail - Generates isolation rules for containers
 */
export class NetworkJail {
    private config: NetworkJailConfig;

    constructor(config: Partial<NetworkJailConfig> = {}) {
        this.config = { ...DEFAULT_NETWORK_JAIL_CONFIG, ...config };
    }

    /**
     * Generate iptables rules for blocking internal networks
     */
    generateIptablesRules(): string[] {
        const rules: string[] = [];

        // Block private networks
        for (const cidr of this.config.blockedCIDRs) {
            const logRule = this.config.logBlocked
                ? `-A OUTPUT -d ${cidr} -j LOG --log-prefix "[SARA-JAIL] "`
                : '';

            if (logRule) rules.push(logRule);
            rules.push(`-A OUTPUT -d ${cidr} -j DROP`);
        }

        // Block Docker metadata endpoints
        if (this.config.blockDockerMeta) {
            for (const ip of DOCKER_METADATA_IPS) {
                rules.push(`-A OUTPUT -d ${ip} -j DROP`);
            }
        }

        // Block ICMP if not allowed
        if (!this.config.allowICMP) {
            rules.push('-A OUTPUT -p icmp -j DROP');
        }

        // Default deny (if enabled, only allow specified ports)
        if (this.config.defaultDeny) {
            for (const port of this.config.allowedPorts) {
                rules.push(`-A OUTPUT -p tcp --dport ${port} -j ACCEPT`);
            }
            rules.push('-A OUTPUT -j DROP');
        }

        return rules;
    }

    /**
     * Generate Docker run arguments for network isolation
     */
    generateDockerArgs(): string[] {
        const args: string[] = [];

        // DNS configuration
        for (const dns of this.config.dnsServers) {
            args.push('--dns', dns);
        }

        // Disable automatic DNS from host
        args.push('--dns-opt', 'ndots:0');

        // Security: drop all capabilities, add only NET_ADMIN for iptables
        // Note: In production, consider using a sidecar container for iptables
        // instead of giving NET_ADMIN to the main container

        return args;
    }

    /**
     * Generate a shell script to apply iptables rules inside container
     */
    generateIptablesScript(): string {
        const rules = this.generateIptablesRules();

        const script = `#!/bin/sh
# Sara Network Jail - Auto-generated iptables rules
# WARNING: This script blocks access to internal networks

# Flush existing rules
iptables -F OUTPUT 2>/dev/null || true

# Apply blocking rules
${rules.map(rule => `iptables ${rule}`).join('\n')}

echo "[NETWORK-JAIL] Rules applied: ${rules.length} rules"
`;

        return script;
    }

    /**
     * Get full Docker network configuration
     */
    getDockerNetworkConfig(): DockerNetworkConfig {
        return {
            iptablesRules: this.generateIptablesRules(),
            dns: this.config.dnsServers,
            networkMode: 'bridge', // Need bridge for outbound web access
            dockerArgs: this.generateDockerArgs(),
        };
    }

    /**
     * Validate a URL is not targeting internal network
     */
    isUrlBlocked(url: string): { blocked: boolean; reason?: string } {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname;

            // Block file:// protocol
            if (parsed.protocol === 'file:') {
                return { blocked: true, reason: 'File protocol not allowed' };
            }

            // Block localhost (IPv4 and IPv6)
            if (hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname === '::1' ||
                hostname === '[::1]') {
                return { blocked: true, reason: 'Localhost access blocked (IPv4/IPv6)' };
            }

            // Check against private IP patterns
            if (this.isPrivateIP(hostname)) {
                return { blocked: true, reason: `Private network access blocked: ${hostname}` };
            }

            // Check for common router hostnames
            const routerPatterns = ['router', 'gateway', 'admin', 'modem', 'fritz.box'];
            if (routerPatterns.some(p => hostname.toLowerCase().includes(p))) {
                return { blocked: true, reason: `Suspicious hostname blocked: ${hostname}` };
            }

            return { blocked: false };

        } catch {
            return { blocked: true, reason: 'Invalid URL' };
        }
    }

    /**
     * Check if an IP address is in private range
     */
    private isPrivateIP(ip: string): boolean {
        // Simple pattern matching for common private ranges
        const privatePatterns = [
            // IPv4 patterns
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[01])\./,
            /^192\.168\./,
            /^127\./,
            /^169\.254\./,
            // IPv6 patterns (CRITICAL for security!)
            /^::1$/,                    // Loopback
            /^\[::1\]$/,               // Loopback in URL format
            /^fc[0-9a-f]{2}:/i,        // Unique local
            /^fd[0-9a-f]{2}:/i,        // Private
            /^fe80:/i,                 // Link-local
            /^::ffff:10\./i,           // IPv4-mapped IPv6 (10.x)
            /^::ffff:192\.168\./i,     // IPv4-mapped IPv6 (192.168.x)
            /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./i, // IPv4-mapped IPv6 (172.16.x)
        ];

        return privatePatterns.some(pattern => pattern.test(ip));
    }

    /**
     * Get configuration summary
     */
    getSummary(): string {
        return [
            `NetworkJail Configuration:`,
            `  Blocked CIDRs: ${this.config.blockedCIDRs.length}`,
            `  DNS Servers: ${this.config.dnsServers.join(', ')}`,
            `  Allowed Ports: ${this.config.allowedPorts.join(', ')}`,
            `  Default Deny: ${this.config.defaultDeny}`,
            `  Block Docker Meta: ${this.config.blockDockerMeta}`,
        ].join('\n');
    }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a new NetworkJail instance
 */
export function createNetworkJail(config?: Partial<NetworkJailConfig>): NetworkJail {
    return new NetworkJail(config);
}

/**
 * Create a strict jail (blocks everything except web)
 */
export function createStrictNetworkJail(): NetworkJail {
    return new NetworkJail({
        ...DEFAULT_NETWORK_JAIL_CONFIG,
        defaultDeny: true,
        allowICMP: false,
        logBlocked: true,
    });
}

/**
 * Validate URL before navigation (quick check, no network)
 */
export function validateUrl(url: string): { valid: boolean; reason?: string } {
    const jail = new NetworkJail();
    const result = jail.isUrlBlocked(url);
    return { valid: !result.blocked, reason: result.reason };
}
