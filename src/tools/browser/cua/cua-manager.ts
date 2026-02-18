/**
 * Sara CUA - CUA Manager
 * 
 * High-level Computer Use Agent orchestrator.
 * Handles click, type, navigate with security controls.
 */

import { EventEmitter } from 'events';
// Playwright Page type (inline to avoid dependency issues)
interface Page {
    evaluate: (script: string) => Promise<unknown>;
    click: (selector: string) => Promise<void>;
    fill: (selector: string, value: string) => Promise<void>;
    goto: (url: string, options?: { waitUntil?: string }) => Promise<void>;
    waitForTimeout: (ms: number) => Promise<void>;
    waitForSelector: (selector: string, options?: { timeout?: number }) => Promise<void>;
    screenshot: (options?: { path?: string; fullPage?: boolean }) => Promise<void>;
    url: () => string;
}
import { DOMSnapshotter, DOMSnapshot, InteractiveElement, createDOMSnapshotter } from './dom-snapshotter.js';
import { ValidationGate, ApprovalResult, createValidationGate } from './validation-gate.js';

// ============================================
// TYPES
// ============================================

/**
 * CUA action types
 */
export type CUAActionType = 'click' | 'type' | 'navigate' | 'scroll' | 'screenshot' | 'wait';

/**
 * Action result
 */
export interface ActionResult {
    /** Whether action succeeded */
    success: boolean;

    /** Action that was performed */
    action: CUAActionType;

    /** Target element/URL */
    target: string;

    /** Duration in ms */
    durationMs: number;

    /** Error message if failed */
    error?: string;

    /** Whether approval was required */
    approvalRequired: boolean;

    /** Approval result if relevant */
    approval?: ApprovalResult;

    /** Screenshot path if taken */
    screenshotPath?: string;

    /** Updated DOM snapshot */
    snapshot?: DOMSnapshot;
}

/**
 * CUA Manager configuration
 */
export interface CUAManagerConfig {
    /** Min delay between actions (human simulation) */
    minDelayMs: number;

    /** Max delay between actions */
    maxDelayMs: number;

    /** Take screenshot before critical actions */
    screenshotOnCritical: boolean;

    /** Screenshot output directory */
    screenshotDir: string;

    /** Require approval for critical actions */
    requireApproval: boolean;

    /** Patterns to block from typing (API keys, passwords) */
    blockedPatterns: RegExp[];

    /** Verbose logging */
    verbose: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: CUAManagerConfig = {
    minDelayMs: 500,
    maxDelayMs: 2000,
    screenshotOnCritical: true,
    screenshotDir: '/home/node/saraclaw/outputs/screenshots',
    requireApproval: true,
    blockedPatterns: [
        /^sk-[a-zA-Z0-9]{32,}$/,           // OpenAI API keys
        /^AIza[a-zA-Z0-9_-]{35}$/,          // Google API keys
        /^ghp_[a-zA-Z0-9]{36}$/,            // GitHub tokens
        /password|senha|secret/i,           // Password fields
        /^[a-f0-9]{64}$/,                   // 256-bit hex secrets
    ],
    verbose: true,
};

// ============================================
// CUA MANAGER
// ============================================

/**
 * CUA Manager
 * 
 * Orchestrates browser automation with security controls.
 */
export class CUAManager extends EventEmitter {
    private config: CUAManagerConfig;
    private snapshotter: DOMSnapshotter;
    private gate: ValidationGate;
    private currentSnapshot: DOMSnapshot | null = null;
    private actionLog: ActionResult[] = [];

    constructor(config: Partial<CUAManagerConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.snapshotter = createDOMSnapshotter();
        this.gate = createValidationGate({ verbose: this.config.verbose });

        // Forward gate events
        this.gate.on('approval_required', (req) => this.emit('approval_required', req));
        this.gate.on('approval_resolved', (req) => this.emit('approval_resolved', req));
    }

    /**
     * Take a DOM snapshot of the current page
     */
    async takeSnapshot(page: Page): Promise<DOMSnapshot> {
        const script = this.snapshotter.generateExtractionScript();
        const raw = await page.evaluate(script);
        this.currentSnapshot = this.snapshotter.processExtractionResult(raw as Parameters<typeof this.snapshotter.processExtractionResult>[0]);

        this.log(`📸 Snapshot: ${this.currentSnapshot.elements.length} elements on "${this.currentSnapshot.title}"`);

        return this.currentSnapshot;
    }

    /**
     * Click an element
     */
    async click(page: Page, target: string | InteractiveElement): Promise<ActionResult> {
        const start = Date.now();

        // Resolve element
        const element = typeof target === 'string'
            ? this.findElement(target)
            : target;

        if (!element) {
            return this.failResult('click', typeof target === 'string' ? target : target.selector,
                'Element not found', start);
        }

        // Check if approval needed
        if (this.config.requireApproval && element.isCritical) {
            const pageContext = this.getPageContext(page);
            let screenshotPath: string | undefined;

            if (this.config.screenshotOnCritical) {
                screenshotPath = await this.takeScreenshot(page, `click-${element.id}`);
            }

            const approval = await this.gate.requestApproval({
                actionType: 'click',
                element,
                pageContext,
                screenshotPath,
            });

            if (!approval.approved) {
                return {
                    success: false,
                    action: 'click',
                    target: element.selector,
                    durationMs: Date.now() - start,
                    error: 'Action rejected by user',
                    approvalRequired: true,
                    approval,
                };
            }
        }

        // Simulate human delay
        await this.humanDelay();

        try {
            await page.click(element.selector);
            await this.takeSnapshot(page);

            const result: ActionResult = {
                success: true,
                action: 'click',
                target: element.selector,
                durationMs: Date.now() - start,
                approvalRequired: element.isCritical,
                snapshot: this.currentSnapshot || undefined,
            };

            this.actionLog.push(result);
            this.emit('action_completed', result);
            this.log(`✅ Click: "${element.label}"`);

            return result;
        } catch (err) {
            return this.failResult('click', element.selector,
                err instanceof Error ? err.message : String(err), start);
        }
    }

    /**
     * Type text into an element
     */
    async type(page: Page, target: string | InteractiveElement, text: string): Promise<ActionResult> {
        const start = Date.now();

        // Check for blocked patterns (The Censor)
        for (const pattern of this.config.blockedPatterns) {
            if (pattern.test(text)) {
                this.emit('blocked_input', { text, pattern: pattern.toString() });
                return this.failResult('type', typeof target === 'string' ? target : target.selector,
                    'Input blocked by The Censor: sensitive pattern detected', start);
            }
        }

        const element = typeof target === 'string'
            ? this.findElement(target)
            : target;

        if (!element) {
            return this.failResult('type', typeof target === 'string' ? target : target.selector,
                'Element not found', start);
        }

        // Check if approval needed for form inputs
        if (this.config.requireApproval && element.isCritical) {
            const pageContext = this.getPageContext(page);

            const approval = await this.gate.requestApproval({
                actionType: 'type',
                element,
                value: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
                pageContext,
            });

            if (!approval.approved) {
                return {
                    success: false,
                    action: 'type',
                    target: element.selector,
                    durationMs: Date.now() - start,
                    error: 'Action rejected by user',
                    approvalRequired: true,
                    approval,
                };
            }
        }

        await this.humanDelay();

        try {
            await page.fill(element.selector, text);

            const result: ActionResult = {
                success: true,
                action: 'type',
                target: element.selector,
                durationMs: Date.now() - start,
                approvalRequired: element.isCritical,
            };

            this.actionLog.push(result);
            this.emit('action_completed', result);
            this.log(`✅ Type: "${text.slice(0, 20)}..." into "${element.label}"`);

            return result;
        } catch (err) {
            return this.failResult('type', element.selector,
                err instanceof Error ? err.message : String(err), start);
        }
    }

    /**
     * Navigate to a URL
     */
    async navigate(page: Page, url: string): Promise<ActionResult> {
        const start = Date.now();

        await this.humanDelay();

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await this.takeSnapshot(page);

            const result: ActionResult = {
                success: true,
                action: 'navigate',
                target: url,
                durationMs: Date.now() - start,
                approvalRequired: false,
                snapshot: this.currentSnapshot || undefined,
            };

            this.actionLog.push(result);
            this.emit('action_completed', result);
            this.log(`✅ Navigate: ${url}`);

            return result;
        } catch (err) {
            return this.failResult('navigate', url,
                err instanceof Error ? err.message : String(err), start);
        }
    }

    /**
     * Wait for element or condition
     */
    async waitFor(page: Page, selectorOrMs: string | number): Promise<ActionResult> {
        const start = Date.now();

        try {
            if (typeof selectorOrMs === 'number') {
                await page.waitForTimeout(selectorOrMs);
            } else {
                await page.waitForSelector(selectorOrMs, { timeout: 30000 });
            }

            await this.takeSnapshot(page);

            return {
                success: true,
                action: 'wait',
                target: String(selectorOrMs),
                durationMs: Date.now() - start,
                approvalRequired: false,
            };
        } catch (err) {
            return this.failResult('wait', String(selectorOrMs),
                err instanceof Error ? err.message : String(err), start);
        }
    }

    /**
     * Take a screenshot
     */
    async takeScreenshot(page: Page, name: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const filename = `${name}-${timestamp}.png`;
        const path = `${this.config.screenshotDir}/${filename}`;

        try {
            await page.screenshot({ path, fullPage: false });
            this.log(`📷 Screenshot: ${path}`);
            return path;
        } catch (err) {
            this.log(`⚠️ Screenshot failed: ${err}`);
            return '';
        }
    }

    /**
     * Approve a pending action
     */
    approve(requestId: string, approvedBy: string = 'user'): boolean {
        return this.gate.approve(requestId, approvedBy);
    }

    /**
     * Reject a pending action
     */
    reject(requestId: string, rejectedBy: string = 'user'): boolean {
        return this.gate.reject(requestId, rejectedBy);
    }

    /**
     * Get pending approval requests
     */
    getPendingApprovals() {
        return this.gate.getPendingRequests();
    }

    /**
     * Find element in current snapshot
     */
    private findElement(query: string): InteractiveElement | undefined {
        if (!this.currentSnapshot) return undefined;

        // Try by ID first
        if (query.startsWith('el-')) {
            return this.snapshotter.findById(this.currentSnapshot, query);
        }

        // Try by selector
        const bySelector = this.currentSnapshot.elements.find(el => el.selector === query);
        if (bySelector) return bySelector;

        // Try fuzzy label match
        const byLabel = this.snapshotter.findByLabel(this.currentSnapshot, query);
        return byLabel[0];
    }

    /**
     * Get current page context
     */
    private getPageContext(page: Page): { url: string; title: string } {
        return {
            url: this.currentSnapshot?.url || page.url(),
            title: this.currentSnapshot?.title || 'Unknown',
        };
    }

    /**
     * Simulate human delay
     */
    private async humanDelay(): Promise<void> {
        const delay = this.config.minDelayMs +
            Math.random() * (this.config.maxDelayMs - this.config.minDelayMs);
        await new Promise(r => setTimeout(r, delay));
    }

    /**
     * Create failure result
     */
    private failResult(action: CUAActionType, target: string, error: string, start: number): ActionResult {
        const result: ActionResult = {
            success: false,
            action,
            target,
            durationMs: Date.now() - start,
            error,
            approvalRequired: false,
        };
        this.actionLog.push(result);
        this.emit('action_failed', result);
        this.log(`❌ ${action}: ${error}`);
        return result;
    }

    /**
     * Get action history
     */
    getActionLog(): ActionResult[] {
        return [...this.actionLog];
    }

    /**
     * Get current snapshot
     */
    getSnapshot(): DOMSnapshot | null {
        return this.currentSnapshot;
    }

    /**
     * Log if verbose
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[CUAManager] ${message}`);
        }
        this.emit('log', message);
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a CUA Manager instance
 */
export function createCUAManager(config?: Partial<CUAManagerConfig>): CUAManager {
    return new CUAManager(config);
}
