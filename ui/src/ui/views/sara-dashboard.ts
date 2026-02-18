/**
 * Sara Dashboard - Main Container
 * 
 * The Sovereign Interface - Sara's command center dashboard.
 * Displays real-time state of the autonomous entity.
 */

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

// ============================================
// TYPES
// ============================================

interface SaraStatus {
    scheduler: {
        state: 'STOPPED' | 'IDLE' | 'PULSING' | 'ERROR' | 'SHUTDOWN' | 'BUDGET_EXHAUSTED';
        uptime: number;
        nextPulseAt: string | null;
        lastPulseAt: string | null;
        metrics: {
            total: number;
            successful: number;
            failed: number;
            research: number;
            idle: number;
        };
    };
    budget: {
        dailyCost: number;
        dailyLimit: number;
        usagePercent: number;
        isExhausted: boolean;
        msUntilReset: number;
    };
    security: {
        censorEvents: number;
        jailEvents: number;
        lastIncident: string | null;
    };
    monologue: {
        lastEntries: string[];
        curiosityLevel: number;
    };
}

// ============================================
// COMPONENT
// ============================================

@customElement('sara-dashboard')
export class SaraDashboard extends LitElement {
    @state() private status: SaraStatus = {
        scheduler: {
            state: 'IDLE',
            uptime: 0,
            nextPulseAt: null,
            lastPulseAt: null,
            metrics: { total: 0, successful: 0, failed: 0, research: 0, idle: 0 },
        },
        budget: {
            dailyCost: 0,
            dailyLimit: 2.00,
            usagePercent: 0,
            isExhausted: false,
            msUntilReset: 0,
        },
        security: {
            censorEvents: 0,
            jailEvents: 0,
            lastIncident: null,
        },
        monologue: {
            lastEntries: [],
            curiosityLevel: 0,
        },
    };

    @state() private connected = false;
    @state() private nextPulseCountdown = '--:--';

    private refreshInterval: number | null = null;
    private uptimeInterval: number | null = null;

    static styles = css`
        :host {
            display: block;
            --sara-bg: #0a0a0f;
            --sara-panel: #12121a;
            --sara-panel-border: #1e1e2a;
            --sara-accent: #00ff88;
            --sara-accent-dim: #00cc6a;
            --sara-warning: #ffaa00;
            --sara-danger: #ff4444;
            --sara-text: #e0e0e0;
            --sara-text-muted: #666;
            --sara-text-bright: #ffffff;
            --sara-gap: 16px;
            --sara-radius: 8px;
            --sara-font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        }

        .dashboard {
            display: grid;
            grid-template-columns: 1fr 1.5fr 1fr;
            grid-template-rows: auto 1fr auto;
            gap: var(--sara-gap);
            padding: var(--sara-gap);
            min-height: 100vh;
            background: var(--sara-bg);
            color: var(--sara-text);
            font-family: system-ui, -apple-system, sans-serif;
            box-sizing: border-box;
        }

        .header {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 20px;
            background: var(--sara-panel);
            border: 1px solid var(--sara-panel-border);
            border-radius: var(--sara-radius);
        }

        .title {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--sara-text-bright);
        }

        .title::before {
            content: '◈';
            color: var(--sara-accent);
            font-size: 1.5rem;
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: rgba(0, 255, 136, 0.1);
            border: 1px solid var(--sara-accent);
            border-radius: 20px;
            font-size: 0.75rem;
            color: var(--sara-accent);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-badge.offline {
            background: rgba(255, 68, 68, 0.1);
            border-color: var(--sara-danger);
            color: var(--sara-danger);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
            animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }

        .panel {
            background: var(--sara-panel);
            border: 1px solid var(--sara-panel-border);
            border-radius: var(--sara-radius);
            padding: 16px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--sara-panel-border);
        }

        .panel-title {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--sara-text-muted);
        }

        /* Pulse Monitor */
        .pulse-indicator {
            width: 100px;
            height: 100px;
            margin: 16px auto;
            border-radius: 50%;
            background: radial-gradient(circle at center, var(--sara-accent) 0%, transparent 70%);
            opacity: 0.3;
            transition: opacity 0.3s ease, transform 0.3s ease;
            animation: pulse-glow 2s ease-in-out infinite;
        }

        .pulse-indicator.active {
            opacity: 1;
            animation: pulse-active 0.8s ease-in-out infinite;
        }

        .pulse-indicator.exhausted {
            background: radial-gradient(circle at center, var(--sara-warning) 0%, transparent 70%);
            animation: none;
            opacity: 0.5;
        }

        @keyframes pulse-glow {
            0%, 100% { transform: scale(0.9); opacity: 0.3; }
            50% { transform: scale(1); opacity: 0.5; }
        }

        @keyframes pulse-active {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        .pulse-state {
            text-align: center;
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--sara-accent);
        }

        .pulse-state.exhausted {
            color: var(--sara-warning);
        }

        .pulse-meta {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 16px;
        }

        .pulse-meta-item {
            display: flex;
            justify-content: space-between;
            font-size: 0.8125rem;
        }

        .meta-label {
            color: var(--sara-text-muted);
        }

        .meta-value {
            font-family: var(--sara-font-mono);
            color: var(--sara-text-bright);
        }

        /* Monologue Feed */
        .monologue-feed {
            flex: 1;
            overflow-y: auto;
            background: linear-gradient(180deg, var(--sara-bg) 0%, #0a0a12 100%);
            border-radius: 4px;
            padding: 12px;
            font-family: var(--sara-font-mono);
            font-size: 0.75rem;
            line-height: 1.6;
            max-height: 400px;
        }

        .monologue-entry {
            color: var(--sara-accent);
            opacity: 0.7;
            margin-bottom: 6px;
            padding-left: 14px;
            position: relative;
        }

        .monologue-entry::before {
            content: '▸';
            position: absolute;
            left: 0;
            color: var(--sara-accent-dim);
        }

        .monologue-entry:last-child {
            opacity: 1;
        }

        .curiosity-bar {
            margin-top: 12px;
            height: 4px;
            background: var(--sara-bg);
            border-radius: 2px;
            overflow: hidden;
        }

        .curiosity-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--sara-accent-dim), var(--sara-accent));
            transition: width 0.5s ease;
        }

        /* Gauges */
        .gauge {
            background: var(--sara-bg);
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 16px;
        }

        .gauge-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 0.75rem;
        }

        .gauge-label {
            color: var(--sara-text-muted);
        }

        .gauge-value {
            font-family: var(--sara-font-mono);
            color: var(--sara-text-bright);
        }

        .gauge-bar {
            height: 6px;
            background: var(--sara-panel-border);
            border-radius: 3px;
            overflow: hidden;
        }

        .gauge-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--sara-accent-dim), var(--sara-accent));
            transition: width 0.5s ease;
        }

        .gauge-fill.warning {
            background: linear-gradient(90deg, var(--sara-warning), #ff8800);
        }

        .gauge-fill.danger {
            background: linear-gradient(90deg, var(--sara-danger), #ff2222);
        }

        .incidents {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
        }

        .incident-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 12px;
            background: var(--sara-bg);
            border-radius: 4px;
        }

        .incident-count {
            font-size: 1.5rem;
            font-weight: 700;
            font-family: var(--sara-font-mono);
            color: var(--sara-text-bright);
        }

        .incident-label {
            font-size: 0.625rem;
            color: var(--sara-text-muted);
            text-transform: uppercase;
            margin-top: 4px;
        }

        .kill-switch {
            margin-top: auto;
        }

        .kill-switch-btn {
            width: 100%;
            padding: 10px 16px;
            background: transparent;
            border: 2px solid var(--sara-danger);
            color: var(--sara-danger);
            border-radius: var(--sara-radius);
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .kill-switch-btn:hover {
            background: var(--sara-danger);
            color: var(--sara-bg);
        }

        /* Chat */
        .chat-panel {
            grid-column: 1 / -1;
        }

        .chat-input {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }

        .chat-input input {
            flex: 1;
            padding: 10px 14px;
            background: var(--sara-bg);
            border: 1px solid var(--sara-panel-border);
            border-radius: var(--sara-radius);
            color: var(--sara-text);
            font-size: 0.875rem;
        }

        .chat-input input:focus {
            outline: none;
            border-color: var(--sara-accent);
        }

        .chat-input button {
            padding: 10px 20px;
            background: var(--sara-accent);
            border: none;
            border-radius: var(--sara-radius);
            color: var(--sara-bg);
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
        }

        .chat-input button:hover {
            opacity: 0.9;
        }

        @media (max-width: 900px) {
            .dashboard {
                grid-template-columns: 1fr 1fr;
            }
            .monologue-panel {
                grid-column: 1 / -1;
                order: 1;
            }
        }

        @media (max-width: 600px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
        }
    `;

    connectedCallback() {
        super.connectedCallback();
        this.startPolling();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.stopPolling();
    }

    private startPolling() {
        this.fetchStatus();
        this.refreshInterval = window.setInterval(() => this.fetchStatus(), 5000);
        this.uptimeInterval = window.setInterval(() => this.updateCountdown(), 1000);
    }

    private stopPolling() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        if (this.uptimeInterval) clearInterval(this.uptimeInterval);
    }

    private async fetchStatus() {
        try {
            // In production, this would use the gateway WebSocket
            // For now, simulate with mock data
            this.connected = true;

            // Mock data for demo
            this.status = {
                ...this.status,
                scheduler: {
                    ...this.status.scheduler,
                    uptime: this.status.scheduler.uptime + 5000,
                },
            };
        } catch (err) {
            this.connected = false;
        }
    }

    private updateCountdown() {
        if (this.status.scheduler.nextPulseAt) {
            const next = new Date(this.status.scheduler.nextPulseAt).getTime();
            const now = Date.now();
            const diff = Math.max(0, next - now);
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            this.nextPulseCountdown = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }

    private formatUptime(ms: number): string {
        const hours = Math.floor(ms / 3600000);
        const mins = Math.floor((ms % 3600000) / 60000);
        return `${hours}h ${mins}m`;
    }

    private async handleKillSwitch() {
        if (!confirm('⚠️ EMERGENCY STOP\n\nIsto vai desativar a Sara imediatamente.\n\nContinuar?')) {
            return;
        }

        // Trigger emergency stop
        try {
            // In production: gateway.request('sara.emergency-stop', { source: 'ui' });
            this.status = {
                ...this.status,
                scheduler: { ...this.status.scheduler, state: 'SHUTDOWN' },
            };
        } catch (err) {
            console.error('Failed to trigger emergency stop:', err);
        }
    }

    render() {
        const { scheduler, budget, security, monologue } = this.status;
        const isExhausted = scheduler.state === 'BUDGET_EXHAUSTED';
        const isPulsing = scheduler.state === 'PULSING';
        const budgetPercent = budget.dailyLimit > 0 ? (budget.dailyCost / budget.dailyLimit) * 100 : 0;
        const budgetClass = budgetPercent >= 90 ? 'danger' : budgetPercent >= 70 ? 'warning' : '';

        return html`
            <div class="dashboard">
                <!-- Header -->
                <header class="header">
                    <div class="title">SARA SOVEREIGN INTERFACE</div>
                    <div class="status-badge ${this.connected ? '' : 'offline'}">
                        <span class="status-dot"></span>
                        ${this.connected ? 'ONLINE' : 'OFFLINE'}
                    </div>
                </header>

                <!-- Pulse Monitor -->
                <div class="panel">
                    <div class="panel-header">
                        <span class="panel-title">Pulse Monitor</span>
                    </div>
                    <div class="pulse-indicator ${isPulsing ? 'active' : ''} ${isExhausted ? 'exhausted' : ''}"></div>
                    <div class="pulse-state ${isExhausted ? 'exhausted' : ''}">${scheduler.state}</div>
                    <div class="pulse-meta">
                        <div class="pulse-meta-item">
                            <span class="meta-label">Uptime</span>
                            <span class="meta-value">${this.formatUptime(scheduler.uptime)}</span>
                        </div>
                        <div class="pulse-meta-item">
                            <span class="meta-label">Próximo Pulso</span>
                            <span class="meta-value">${this.nextPulseCountdown}</span>
                        </div>
                        <div class="pulse-meta-item">
                            <span class="meta-label">Total</span>
                            <span class="meta-value">${scheduler.metrics.total}</span>
                        </div>
                    </div>
                </div>

                <!-- Inner Monologue -->
                <div class="panel monologue-panel">
                    <div class="panel-header">
                        <span class="panel-title">Inner Monologue</span>
                    </div>
                    <div class="monologue-feed">
                        ${monologue.lastEntries.length === 0
                ? html`<div class="monologue-entry">Aguardando próximo ciclo de reflexão...</div>`
                : monologue.lastEntries.map(entry => html`
                                <div class="monologue-entry">${entry}</div>
                            `)}
                    </div>
                    <div class="curiosity-bar">
                        <div class="curiosity-fill" style="width: ${monologue.curiosityLevel * 100}%"></div>
                    </div>
                </div>

                <!-- Security & Budget -->
                <div class="panel">
                    <div class="panel-header">
                        <span class="panel-title">Recursos & Segurança</span>
                    </div>
                    
                    <div class="gauge">
                        <div class="gauge-header">
                            <span class="gauge-label">Orçamento Diário</span>
                            <span class="gauge-value">$${budget.dailyCost.toFixed(2)} / $${budget.dailyLimit.toFixed(2)}</span>
                        </div>
                        <div class="gauge-bar">
                            <div class="gauge-fill ${budgetClass}" style="width: ${Math.min(100, budgetPercent)}%"></div>
                        </div>
                    </div>

                    <div class="incidents">
                        <div class="incident-item">
                            <span class="incident-count">${security.censorEvents}</span>
                            <span class="incident-label">Censor</span>
                        </div>
                        <div class="incident-item">
                            <span class="incident-count">${security.jailEvents}</span>
                            <span class="incident-label">Jail</span>
                        </div>
                    </div>

                    <div class="kill-switch">
                        <button class="kill-switch-btn" @click=${this.handleKillSwitch}>
                            🚨 Emergency Stop
                        </button>
                    </div>
                </div>

                <!-- Chat Panel -->
                <div class="panel chat-panel">
                    <div class="panel-header">
                        <span class="panel-title">Dialogue</span>
                    </div>
                    <div class="chat-input">
                        <input type="text" placeholder="Fale com a Sara..." />
                        <button>Enviar</button>
                    </div>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'sara-dashboard': SaraDashboard;
    }
}
