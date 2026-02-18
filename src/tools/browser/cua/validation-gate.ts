/**
 * Sara CUA - Validation Gate
 * 
 * Approval workflow for critical actions.
 * Pauses execution and awaits user confirmation.
 */

import { EventEmitter } from 'events';
import type { InteractiveElement } from './dom-snapshotter.js';

// ============================================
// TYPES
// ============================================

/**
 * Approval request status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timeout';

/**
 * Approval request
 */
export interface ApprovalRequest {
    /** Unique request ID */
    id: string;

    /** Timestamp of request */
    timestamp: Date;

    /** Action type being requested */
    actionType: 'click' | 'type' | 'submit' | 'navigate';

    /** Target element info */
    target: {
        selector: string;
        label: string;
        type: string;
    };

    /** Value being typed (if applicable) */
    value?: string;

    /** URL being navigated to (if applicable) */
    url?: string;

    /** Why this is considered critical */
    reason: string;

    /** Current page context */
    pageContext: {
        url: string;
        title: string;
    };

    /** Screenshot path (if available) */
    screenshotPath?: string;

    /** Current status */
    status: ApprovalStatus;

    /** Resolution timestamp */
    resolvedAt?: Date;

    /** User who approved/rejected */
    resolvedBy?: string;
}

/**
 * Approval result
 */
export interface ApprovalResult {
    approved: boolean;
    request: ApprovalRequest;
    message?: string;
}

/**
 * Validation Gate configuration
 */
export interface ValidationGateConfig {
    /** Timeout for approval in ms (default: 5 minutes) */
    approvalTimeoutMs: number;

    /** Auto-approve non-critical actions */
    autoApproveNonCritical: boolean;

    /** Require screenshot for approval requests */
    requireScreenshot: boolean;

    /** Verbose logging */
    verbose: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: ValidationGateConfig = {
    approvalTimeoutMs: 5 * 60 * 1000, // 5 minutes
    autoApproveNonCritical: true,
    requireScreenshot: true,
    verbose: false,
};

// ============================================
// VALIDATION GATE
// ============================================

/**
 * Validation Gate
 * 
 * Manages approval workflow for critical CUA actions.
 */
export class ValidationGate extends EventEmitter {
    private config: ValidationGateConfig;
    private pendingRequests: Map<string, {
        request: ApprovalRequest;
        resolve: (result: ApprovalResult) => void;
        timeoutId: NodeJS.Timeout;
    }> = new Map();
    private requestHistory: ApprovalRequest[] = [];
    private idCounter: number = 0;

    constructor(config: Partial<ValidationGateConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Generate unique request ID
     */
    private generateRequestId(): string {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        return `APR-${timestamp}-${++this.idCounter}`;
    }

    /**
     * Request approval for an action
     */
    async requestApproval(params: {
        actionType: ApprovalRequest['actionType'];
        element: InteractiveElement;
        value?: string;
        url?: string;
        pageContext: { url: string; title: string };
        screenshotPath?: string;
        reason?: string;
    }): Promise<ApprovalResult> {
        // Auto-approve non-critical if configured
        if (this.config.autoApproveNonCritical && !params.element.isCritical) {
            const autoRequest = this.createRequest(params, 'approved');
            this.requestHistory.push(autoRequest);
            return { approved: true, request: autoRequest };
        }

        const request = this.createRequest(params, 'pending');

        return new Promise((resolve) => {
            // Set timeout
            const timeoutId = setTimeout(() => {
                this.resolveRequest(request.id, false, 'timeout', 'Timeout: approval not received in time');
            }, this.config.approvalTimeoutMs);

            // Store pending request
            this.pendingRequests.set(request.id, {
                request,
                resolve,
                timeoutId,
            });

            // Emit event for UI/Gateway
            this.emit('approval_required', request);

            this.log(`⏳ Awaiting approval for: ${params.actionType} on "${params.element.label}"`);
        });
    }

    /**
     * Create an approval request object
     */
    private createRequest(
        params: {
            actionType: ApprovalRequest['actionType'];
            element: InteractiveElement;
            value?: string;
            url?: string;
            pageContext: { url: string; title: string };
            screenshotPath?: string;
            reason?: string;
        },
        status: ApprovalStatus
    ): ApprovalRequest {
        return {
            id: this.generateRequestId(),
            timestamp: new Date(),
            actionType: params.actionType,
            target: {
                selector: params.element.selector,
                label: params.element.label,
                type: params.element.type,
            },
            value: params.value,
            url: params.url,
            reason: params.reason || (params.element.isCritical
                ? 'Critical action detected'
                : 'Manual approval required'),
            pageContext: params.pageContext,
            screenshotPath: params.screenshotPath,
            status,
        };
    }

    /**
     * Approve a pending request
     */
    approve(requestId: string, approvedBy: string = 'user'): boolean {
        return this.resolveRequest(requestId, true, approvedBy);
    }

    /**
     * Reject a pending request
     */
    reject(requestId: string, rejectedBy: string = 'user', reason?: string): boolean {
        return this.resolveRequest(requestId, false, rejectedBy, reason);
    }

    /**
     * Resolve a pending request
     */
    private resolveRequest(
        requestId: string,
        approved: boolean,
        resolvedBy: string,
        message?: string
    ): boolean {
        const pending = this.pendingRequests.get(requestId);
        if (!pending) {
            this.log(`⚠️ Request ${requestId} not found or already resolved`);
            return false;
        }

        // Clear timeout
        clearTimeout(pending.timeoutId);

        // Update request
        pending.request.status = approved ? 'approved' : 'rejected';
        pending.request.resolvedAt = new Date();
        pending.request.resolvedBy = resolvedBy;

        // Add to history
        this.requestHistory.push(pending.request);

        // Resolve promise
        pending.resolve({
            approved,
            request: pending.request,
            message,
        });

        // Remove from pending
        this.pendingRequests.delete(requestId);

        // Emit resolution event
        this.emit('approval_resolved', pending.request);

        this.log(`${approved ? '✅' : '❌'} Request ${requestId} ${approved ? 'approved' : 'rejected'} by ${resolvedBy}`);

        return true;
    }

    /**
     * Get all pending requests
     */
    getPendingRequests(): ApprovalRequest[] {
        return Array.from(this.pendingRequests.values()).map(p => p.request);
    }

    /**
     * Get request history
     */
    getHistory(limit: number = 50): ApprovalRequest[] {
        return this.requestHistory.slice(-limit);
    }

    /**
     * Check if action requires approval
     */
    requiresApproval(element: InteractiveElement, actionType: string): boolean {
        // Critical elements always require approval
        if (element.isCritical) return true;

        // Submit actions always require approval
        if (actionType === 'submit') return true;

        // Non-critical and auto-approve enabled
        if (this.config.autoApproveNonCritical) return false;

        // Default: require approval
        return true;
    }

    /**
     * Cancel all pending requests
     */
    cancelAll(reason: string = 'cancelled'): void {
        this.pendingRequests.forEach((pending, id) => {
            clearTimeout(pending.timeoutId);
            pending.request.status = 'rejected';
            pending.request.resolvedAt = new Date();
            pending.resolve({
                approved: false,
                request: pending.request,
                message: reason,
            });
        });
        this.pendingRequests.clear();
        this.log('🚫 All pending approvals cancelled');
    }

    /**
     * Log if verbose
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[ValidationGate] ${message}`);
        }
    }

    /**
     * Format approval request for display
     */
    formatRequest(request: ApprovalRequest): string {
        return `## Approval Request: ${request.id}

**Action**: ${request.actionType.toUpperCase()}
**Target**: ${request.target.label} (${request.target.type})
**Selector**: \`${request.target.selector}\`
${request.value ? `**Value**: "${request.value}"` : ''}
${request.url ? `**URL**: ${request.url}` : ''}

**Page**: ${request.pageContext.title}
**Reason**: ${request.reason}

**Status**: ${request.status.toUpperCase()}
`;
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create a Validation Gate instance
 */
export function createValidationGate(config?: Partial<ValidationGateConfig>): ValidationGate {
    return new ValidationGate(config);
}
