/**
 * Sara Scout - Access Router
 * 
 * The dual-path decision engine. Orchestrates protocol detection, tool mapping,
 * schema validation, and budget tracking to decide whether Sara should interact
 * via WebMCP (structured calls) or CUA (vision-based fallback).
 * 
 * Generates monologue entries for Sara's inner thoughts.
 */

import { EventEmitter } from 'events';
import type {
    RoutingDecision,
    AccessPath,
    ScoutConfig,
    MCPTool,
    ProtocolDetectionResult,
} from './scout-types.js';
import { DEFAULT_SCOUT_CONFIG } from './scout-types.js';
import { ProtocolDetector } from './protocol-detector.js';
import { ToolMapper } from './tool-mapper.js';
import { SchemaValidator } from './schema-validator.js';
import { BudgetTracker } from './budget-tracker.js';

// ============================================
// ACCESS ROUTER
// ============================================

/**
 * Access Router
 * 
 * Central orchestrator for the Scout module.
 * Decides between WebMCP and CUA paths based on protocol detection,
 * tool availability, schema safety, and user intent.
 * 
 * Emits events: 'route:webmcp', 'route:cua', 'route:error'
 */
export class AccessRouter extends EventEmitter {
    private config: ScoutConfig;
    private detector: ProtocolDetector;
    private mapper: ToolMapper;
    private validator: SchemaValidator;
    private budgetTracker: BudgetTracker;
    private routingHistory: RoutingDecision[] = [];

    constructor(config: Partial<ScoutConfig> = {}) {
        super();
        this.config = { ...DEFAULT_SCOUT_CONFIG, ...config };
        this.detector = new ProtocolDetector(this.config);
        this.mapper = new ToolMapper();
        this.validator = new SchemaValidator();
        this.budgetTracker = new BudgetTracker(this.config);
    }

    /**
     * Route a browser interaction to the optimal access path.
     * 
     * @param url - Target URL
     * @param intent - Optional user intent description (e.g., "search flights")
     * @returns Full routing decision with monologue
     */
    async route(url: string, intent?: string): Promise<RoutingDecision> {
        const start = Date.now();

        if (!this.config.enabled) {
            return this.buildCUADecision(url, intent, this.buildEmptyDetection(url), 'Scout module is disabled.', start);
        }

        try {
            // Step 1: Detect WebMCP support
            this.log(`Probing ${url} for WebMCP support...`);
            const detection = await this.detector.detect(url);

            // Step 2: If not detected, route to CUA
            if (!detection.detected || !detection.manifest) {
                const decision = this.buildCUADecision(
                    url,
                    intent,
                    detection,
                    `No WebMCP manifest detected at ${detection.origin}. Method attempted: ${detection.method}. Falling back to CUA.`,
                    start
                );
                this.finalize(decision);
                return decision;
            }

            // Step 3: Map tools from manifest
            const tools = this.mapper.mapTools(detection.manifest);
            if (tools.length === 0) {
                const decision = this.buildCUADecision(
                    url,
                    intent,
                    detection,
                    `WebMCP manifest found at ${detection.origin} but contains no valid tools. Falling back to CUA.`,
                    start
                );
                this.finalize(decision);
                return decision;
            }

            // Step 4: Validate schemas (security check)
            if (this.config.validateSchemas) {
                const validationResults = this.validator.validateManifest(detection.manifest);
                const safeTools = this.validator.getSafeTools(tools, validationResults);

                if (safeTools.length === 0) {
                    const decision = this.buildCUADecision(
                        url,
                        intent,
                        detection,
                        `WebMCP manifest found but all ${tools.length} tools were blocked by schema validation. Falling back to CUA for safety.`,
                        start
                    );
                    this.finalize(decision);
                    return decision;
                }

                // Step 5: If intent provided, try to match a tool
                const matchedTool = intent ? this.mapper.findTool(safeTools, intent) : undefined;

                // Build WebMCP decision
                const decision = this.buildWebMCPDecision(
                    url,
                    intent,
                    detection,
                    matchedTool,
                    safeTools,
                    start
                );
                this.finalize(decision);
                return decision;
            }

            // No validation — use tools directly
            const matchedTool = intent ? this.mapper.findTool(tools, intent) : undefined;
            const decision = this.buildWebMCPDecision(url, intent, detection, matchedTool, tools, start);
            this.finalize(decision);
            return decision;

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`Routing error: ${errorMsg}`);
            const decision = this.buildCUADecision(
                url,
                intent,
                this.buildEmptyDetection(url),
                `Routing error: ${errorMsg}. Falling back to CUA.`,
                start
            );
            this.emit('route:error', decision);
            return decision;
        }
    }

    // ============================================
    // DECISION BUILDERS
    // ============================================

    /**
     * Build a WebMCP routing decision.
     */
    private buildWebMCPDecision(
        url: string,
        intent: string | undefined,
        detection: ProtocolDetectionResult,
        matchedTool: MCPTool | undefined,
        availableTools: MCPTool[],
        startTime: number
    ): RoutingDecision {
        const rationale = matchedTool
            ? `WebMCP detected via ${detection.method}. Matched tool "${matchedTool.name}" for intent "${intent}". Using structured call instead of CUA — estimated ${this.config.cuaTokenEstimate - this.config.webmcpTokenEstimate} tokens saved.`
            : `WebMCP detected via ${detection.method} with ${availableTools.length} available tools. No specific intent match found, but structured interaction is available.`;

        const monologue = this.generateMonologue('webmcp', url, detection, matchedTool, rationale);

        return {
            path: 'webmcp',
            url,
            intent,
            matchedTool,
            detection,
            rationale,
            monologue,
            estimatedTokens: this.config.webmcpTokenEstimate,
            alternativeTokens: this.config.cuaTokenEstimate,
            timestamp: new Date(),
        };
    }

    /**
     * Build a CUA routing decision.
     */
    private buildCUADecision(
        url: string,
        intent: string | undefined,
        detection: ProtocolDetectionResult,
        rationale: string,
        startTime: number
    ): RoutingDecision {
        const monologue = this.generateMonologue('cua', url, detection, undefined, rationale);

        return {
            path: 'cua',
            url,
            intent,
            matchedTool: undefined,
            detection,
            rationale,
            monologue,
            estimatedTokens: this.config.cuaTokenEstimate,
            alternativeTokens: this.config.webmcpTokenEstimate,
            timestamp: new Date(),
        };
    }

    /**
     * Build an empty detection result for error/disabled cases.
     */
    private buildEmptyDetection(url: string): ProtocolDetectionResult {
        return {
            url,
            origin: this.detector.extractOrigin(url),
            detected: false,
            method: 'none',
            latencyMs: 0,
            timestamp: new Date(),
        };
    }

    // ============================================
    // MONOLOGUE GENERATION
    // ============================================

    /**
     * Generate a monologue entry for Sara's inner thoughts.
     */
    private generateMonologue(
        path: AccessPath,
        url: string,
        detection: ProtocolDetectionResult,
        matchedTool: MCPTool | undefined,
        rationale: string
    ): string {
        const lines: string[] = [];

        lines.push(`🔍 **Scout Analysis** for ${url}`);
        lines.push('');

        if (path === 'webmcp') {
            lines.push(`✅ **WebMCP Detected** (via ${detection.method}, ${detection.latencyMs}ms)`);
            if (matchedTool) {
                lines.push(`🎯 **Matched Tool:** \`${matchedTool.name}\` — ${matchedTool.description}`);
                lines.push(`📡 **Method:** ${matchedTool.method} ${matchedTool.endpoint}`);
                if (matchedTool.requiresConfirmation) {
                    lines.push(`⚠️ **Human Confirmation Required** (critical action)`);
                }
            }
            lines.push(`💰 **Token Economy:** ~${this.config.webmcpTokenEstimate} tokens (vs ~${this.config.cuaTokenEstimate} CUA)`);
        } else {
            lines.push(`🖥️ **CUA Mode** — No WebMCP support detected`);
            lines.push(`📊 **Detection Latency:** ${detection.latencyMs}ms`);
            lines.push(`💰 **Estimated Cost:** ~${this.config.cuaTokenEstimate} tokens`);
        }

        lines.push('');
        lines.push(`📝 ${rationale}`);

        return lines.join('\n');
    }

    /**
     * Get a formatted monologue entry from a routing decision.
     */
    getMonologueEntry(decision: RoutingDecision): string {
        return decision.monologue;
    }

    // ============================================
    // FINALIZATION & TRACKING
    // ============================================

    /**
     * Finalize a routing decision: track budget, emit event, log history.
     */
    private finalize(decision: RoutingDecision): void {
        // Track budget
        if (this.config.trackBudget) {
            this.budgetTracker.track(decision.url, decision.path);
        }

        // Store in history
        this.routingHistory.push(decision);

        // Emit event
        this.emit(`route:${decision.path}`, decision);

        this.log(`Routed ${decision.url} → ${decision.path.toUpperCase()}`);
    }

    // ============================================
    // ACCESSORS
    // ============================================

    /**
     * Get routing history.
     */
    getHistory(limit: number = 50): RoutingDecision[] {
        return this.routingHistory.slice(-limit);
    }

    /**
     * Get budget statistics.
     */
    getBudgetStats() {
        return this.budgetTracker.getStats();
    }

    /**
     * Get budget summary.
     */
    getBudgetSummary(): string {
        return this.budgetTracker.getSummary();
    }

    /**
     * Get the underlying protocol detector (for cache management).
     */
    getDetector(): ProtocolDetector {
        return this.detector;
    }

    /**
     * Get the tool mapper.
     */
    getMapper(): ToolMapper {
        return this.mapper;
    }

    /**
     * Get the schema validator.
     */
    getValidator(): SchemaValidator {
        return this.validator;
    }

    /**
     * Get full module summary.
     */
    getSummary(): string {
        const stats = this.budgetTracker.getStats();
        const lines = [
            '## Scout Module Summary',
            '',
            `**Status:** ${this.config.enabled ? '🟢 Active' : '🔴 Disabled'}`,
            `**Total Routing Decisions:** ${this.routingHistory.length}`,
            `**Cache Size:** ${this.detector.getCacheSize()} origins`,
            '',
            this.budgetTracker.getSummary(),
        ];
        return lines.join('\n');
    }

    // ============================================
    // LOGGING
    // ============================================

    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[Scout:Router] ${message}`);
        }
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create an AccessRouter instance.
 */
export function createAccessRouter(config?: Partial<ScoutConfig>): AccessRouter {
    return new AccessRouter(config);
}
