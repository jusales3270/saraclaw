/**
 * Sara Heart - Scheduler
 * 
 * The beating heart of Sara. Manages autonomous pulse cycles with:
 * - State-aware scheduling (no concurrent pulses)
 * - Health metrics tracking
 * - Graceful shutdown
 * - Arrhythmia detection (error handling)
 * - Budget-aware halting (Phase 12: Budgeter)
 * 
 * Usage: npm run sara:heart:start
 * 
 * Env vars:
 * - SARA_PULSE_CRON: Cron expression (default: every 30 min)
 * - SARA_OPENAUGI_PATH: Path to knowledge base
 * - SARA_DRY_RUN: Disable side effects
 * - SARA_DAILY_BUDGET_USD: Daily budget limit in USD
 */

import { runIntegratedPulse } from './pulse.js';
import { Budgeter, createBudgeter, BudgetStatus, HaltSignal } from '../shield/budgeter.js';
import { fileURLToPath } from 'url';

// ============================================
// TYPES
// ============================================

/** Scheduler state */
type SchedulerState = 'STOPPED' | 'IDLE' | 'PULSING' | 'ERROR' | 'SHUTDOWN' | 'BUDGET_EXHAUSTED';

/** Health metrics */
interface HealthMetrics {
    /** Total pulses executed */
    totalPulses: number;

    /** Successful pulses */
    successfulPulses: number;

    /** Failed pulses */
    failedPulses: number;

    /** Pulses that triggered research */
    researchPulses: number;

    /** Pulses that stayed idle */
    idlePulses: number;

    /** Start time */
    startedAt: Date;

    /** Last pulse time */
    lastPulseAt: Date | null;

    /** Last error */
    lastError: string | null;

    /** Consecutive errors */
    consecutiveErrors: number;

    /** Daily cost in USD (from Budgeter) */
    dailyCost: number;

    /** Budget limit in USD */
    budgetLimit: number;
}

/** Scheduler configuration */
interface SchedulerConfig {
    /** Cron expression */
    cronExpression: string;

    /** OpenAugi path */
    openAugiPath: string;

    /** Dry run mode */
    dryRun: boolean;

    /** Use real browser */
    useBrowser: boolean;

    /** Max consecutive errors before pause */
    maxConsecutiveErrors: number;

    /** Pause duration after errors (ms) */
    errorPauseDurationMs: number;

    /** Verbose logging */
    verbose: boolean;

    /** Enable budget enforcement */
    enableBudgeter: boolean;
}

/** Default configuration */
const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
    cronExpression: '*/30 * * * *', // Every 30 minutes
    openAugiPath: './tests/sample-openaugi',
    dryRun: true,
    useBrowser: false,
    maxConsecutiveErrors: 3,
    errorPauseDurationMs: 300000, // 5 minutes
    verbose: true,
    enableBudgeter: true,
};

// ============================================
// SCHEDULER
// ============================================

/**
 * Sara Heart Scheduler
 * 
 * Manages the autonomous heartbeat cycle.
 */
export class SaraScheduler {
    private config: SchedulerConfig;
    private state: SchedulerState = 'STOPPED';
    private metrics: HealthMetrics;
    private cronJob: NodeJS.Timeout | null = null;
    private isProcessing: boolean = false;
    private shutdownRequested: boolean = false;
    private budgeter: Budgeter | null = null;
    private budgetResumeTimer: NodeJS.Timeout | null = null;
    private isPaused: boolean = false;

    private static instance: SaraScheduler | null = null;

    /**
     * Get singleton instance
     */
    public static getInstance(): SaraScheduler {
        if (!SaraScheduler.instance) {
            SaraScheduler.instance = createScheduler();
        }
        return SaraScheduler.instance;
    }

    constructor(config: Partial<SchedulerConfig> = {}) {
        this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
        // Initialize simple metrics first to avoid errors if budgeter logic needs them, though here budgeter is init after
        // Actually budgeter init is safe.
        // We need to call initializeMetrics AFTER checking budgeter if we want budget status, 
        // OR we handle null budgeter in initializeMetrics (which we do).

        // Initialize budgeter if enabled
        if (this.config.enableBudgeter) {
            this.budgeter = createBudgeter({
                verbose: this.config.verbose,
                onBudgetExhausted: (status) => this.handleBudgetExhausted(status),
            });
        }

        this.metrics = this.initializeMetrics();

        if (!SaraScheduler.instance) {
            SaraScheduler.instance = this;
        }
    }

    /**
     * Initialize health metrics
     */
    private initializeMetrics(): HealthMetrics {
        const budgetStatus = this.budgeter?.getStatus();
        return {
            totalPulses: 0,
            successfulPulses: 0,
            failedPulses: 0,
            researchPulses: 0,
            idlePulses: 0,
            startedAt: new Date(),
            lastPulseAt: null,
            lastError: null,
            consecutiveErrors: 0,
            dailyCost: budgetStatus?.dailyCost || 0,
            budgetLimit: budgetStatus?.dailyLimit || 0,
        };
    }

    /**
     * Start the scheduler
     */
    async start(): Promise<void> {
        if (this.state !== 'STOPPED') {
            this.log('Scheduler já está rodando');
            return;
        }

        this.log('═══════════════════════════════════════════════════════════');
        this.log('         SARA HEART SCHEDULER - INICIANDO                  ');
        this.log('═══════════════════════════════════════════════════════════');
        this.log(`Cron: ${this.config.cronExpression}`);
        this.log(`OpenAugi: ${this.config.openAugiPath}`);
        this.log(`Dry Run: ${this.config.dryRun}`);
        this.log(`Browser: ${this.config.useBrowser ? 'ENABLED' : 'SIMULATED'}`);
        this.log('');

        this.state = 'IDLE';
        this.metrics = this.initializeMetrics();

        // Parse cron expression and set up recurring pulses using Croner
        const { Cron } = await import('croner');

        this.log(`Cron: ${this.config.cronExpression}`);
        this.log('');

        // Execute first pulse immediately
        this.log('❤️  Executando primeiro pulso...');
        await this.executePulse();

        // Schedule recurring pulses with proper cron parsing
        const job = new Cron(this.config.cronExpression, () => {
            if (!this.shutdownRequested) {
                this.executePulse().catch(err => {
                    this.log(`Erro não tratado: ${err}`);
                });
            }
        });

        // Store for cleanup (using NodeJS.Timeout-compatible interface)
        this.cronJob = job as unknown as NodeJS.Timeout;

        // Setup graceful shutdown
        this.setupShutdownHandlers();

        this.log('');
        this.log('✅ Scheduler iniciado. Sara está viva!');
        this.log('   Pressione Ctrl+C para encerrar graciosamente.');
        this.log('');
    }

    /**
     * Execute a single pulse
     */
    private async executePulse(): Promise<void> {
        // Check if already processing (pulse lock)
        if (this.isProcessing) {
            this.log('⏳ Pulso anterior ainda em execução. Ignorando este ciclo.');
            return;
        }

        // Check if shutdown requested
        if (this.shutdownRequested) {
            this.log('🛑 Shutdown solicitado. Ignorando pulso.');
            return;
        }

        // Check if paused
        if (this.isPaused) {
            // Pulse stays alive but skips processing
            // We can optionally log "Heartbeat active (paused)" every N cycles if desired
            return;
        }

        // Check consecutive errors
        if (this.metrics.consecutiveErrors >= this.config.maxConsecutiveErrors) {
            this.log(`⚠️  Muitos erros consecutivos (${this.metrics.consecutiveErrors}). Pausando...`);
            this.state = 'ERROR';

            // Auto-recover after pause
            setTimeout(() => {
                this.log('♻️  Tentando recuperar após pausa...');
                this.metrics.consecutiveErrors = 0;
                this.state = 'IDLE';
            }, this.config.errorPauseDurationMs);

            return;
        }

        // Lock and execute
        this.isProcessing = true;
        this.state = 'PULSING';
        this.metrics.totalPulses++;

        const pulseStart = new Date();
        this.log(`[${pulseStart.toISOString()}] ❤️  Pulso #${this.metrics.totalPulses} iniciado...`);

        try {
            const result = await runIntegratedPulse({
                openAugiPath: this.config.openAugiPath,
                dryRun: this.config.dryRun,
                useBrowser: this.config.useBrowser,
                verbose: this.config.verbose,
            });

            // Update metrics
            this.metrics.successfulPulses++;
            this.metrics.consecutiveErrors = 0;
            this.metrics.lastPulseAt = new Date();

            if (result.researched) {
                this.metrics.researchPulses++;
            } else {
                this.metrics.idlePulses++;
            }

            const duration = Date.now() - pulseStart.getTime();
            this.log(`✅ Pulso #${this.metrics.totalPulses} concluído em ${duration}ms`);
            this.log(`   Ação: ${result.researched ? 'RESEARCH' : 'IDLE'}`);

        } catch (error) {
            // Handle arrhythmia
            this.metrics.failedPulses++;
            this.metrics.consecutiveErrors++;
            this.metrics.lastError = String(error);

            this.log(`⚠️  Arritmia detectada no Pulso #${this.metrics.totalPulses}: ${error}`);

            // Log to security audit (in production)
            this.logSecurityEvent('pulse_error', {
                pulseNumber: this.metrics.totalPulses,
                error: String(error),
                consecutiveErrors: this.metrics.consecutiveErrors,
            });
        } finally {
            this.isProcessing = false;
            this.state = 'IDLE';
        }

        // Print health summary periodically
        if (this.metrics.totalPulses % 5 === 0) {
            this.printHealthSummary();
        }
    }

    /**
     * Stop the scheduler
     */
    async stop(): Promise<void> {
        this.log('🛑 Parando scheduler...');
        this.shutdownRequested = true;
        this.state = 'SHUTDOWN';

        // Wait for current pulse to finish
        if (this.isProcessing) {
            this.log('   Aguardando pulso atual finalizar...');
            while (this.isProcessing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Clear interval
        if (this.cronJob) {
            clearInterval(this.cronJob);
            this.cronJob = null;
        }

        this.state = 'STOPPED';
        this.printHealthSummary();
        this.log('✅ Scheduler parado graciosamente.');
    }

    /**
     * Handle budget exhaustion - enter sleep mode until midnight
     */
    private handleBudgetExhausted(status: BudgetStatus): void {
        this.log('💤 Orçamento diário atingido. Vou dormir para economizar...');
        this.log(`   Gasto: $${status.dailyCost.toFixed(4)} / $${status.dailyLimit.toFixed(2)}`);
        this.state = 'BUDGET_EXHAUSTED';

        // Update metrics
        this.metrics.dailyCost = status.dailyCost;
        this.metrics.budgetLimit = status.dailyLimit;

        // Schedule auto-resume at midnight
        if (this.budgetResumeTimer) {
            clearTimeout(this.budgetResumeTimer);
        }

        this.budgetResumeTimer = setTimeout(() => {
            this.log('🌅 Novo dia! Retomando operações...');
            if (this.budgeter) {
                this.budgeter.clearHaltSignal();
            }
            this.state = 'IDLE';
        }, status.msUntilReset);

        this.log(`   Retorno programado em ${Math.ceil(status.msUntilReset / 3600000)}h`);

        // Log security event
        this.logSecurityEvent('budget_exhausted', {
            dailyCost: status.dailyCost,
            dailyLimit: status.dailyLimit,
            msUntilReset: status.msUntilReset,
        });
    }

    /**
     * Emergency stop - triggered by kill-switch command
     */
    async emergencyStop(source: string): Promise<void> {
        this.log(`🚨 EMERGENCY STOP ativado por: ${source}`);

        if (this.budgeter) {
            this.budgeter.handleKillSwitch(source);
        }

        // Log security event
        this.logSecurityEvent('emergency_stop', {
            source,
            timestamp: new Date().toISOString(),
        });

        await this.stop();
    }

    /**
     * Check if a message is a kill-switch command
     */
    isKillSwitchCommand(message: string): boolean {
        return this.budgeter?.isKillSwitchCommand(message) || false;
    }

    /**
     * Get budget status
     */
    getBudgetStatus(): BudgetStatus | null {
        return this.budgeter?.getStatus() || null;
    }

    /**
     * Get sleep message for channels
     */
    getSleepMessage(): string {
        return this.budgeter?.generateSleepMessage() || 'Sistema em pausa.';
    }

    /**
     * Setup shutdown handlers
     */
    private setupShutdownHandlers(): void {
        const shutdown = async () => {
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }

    /**
     * Convert cron expression to interval (simplified)
     */
    private cronToIntervalMs(cron: string): number {
        // Parse simple cron patterns
        // */N * * * * = every N minutes
        const match = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
        if (match) {
            return parseInt(match[1]) * 60 * 1000;
        }

        // Default: 30 minutes
        return 30 * 60 * 1000;
    }

    /**
     * Log message
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[SCHEDULER] ${message}`);
        }
    }

    /**
     * Log security event (would write to JSONL in production)
     */
    private logSecurityEvent(type: string, context: Record<string, unknown>): void {
        const entry = {
            timestamp: new Date().toISOString(),
            type,
            context,
        };

        // In production, this would append to security log
        console.log(`[SECURITY-LOG] ${JSON.stringify(entry)}`);
    }

    /**
     * Print health summary
     */
    private printHealthSummary(): void {
        const uptime = Date.now() - this.metrics.startedAt.getTime();
        const uptimeMinutes = Math.floor(uptime / 60000);

        const idleRate = this.metrics.successfulPulses > 0
            ? (this.metrics.idlePulses / this.metrics.successfulPulses * 100).toFixed(1)
            : '0';

        const actionRate = this.metrics.successfulPulses > 0
            ? (this.metrics.researchPulses / this.metrics.successfulPulses * 100).toFixed(1)
            : '0';

        console.log('');
        console.log('📊 HEALTH METRICS:');
        console.log(`   Uptime: ${uptimeMinutes} min`);
        console.log(`   Total Pulses: ${this.metrics.totalPulses}`);
        console.log(`   Success Rate: ${this.metrics.successfulPulses}/${this.metrics.totalPulses}`);
        console.log(`   Idle Rate: ${idleRate}%`);
        console.log(`   Action Rate: ${actionRate}%`);
        console.log(`   Consecutive Errors: ${this.metrics.consecutiveErrors}`);
        if (this.metrics.lastError) {
            console.log(`   Last Error: ${this.metrics.lastError}`);
        }
        console.log('');
    }

    /**
     * Get current metrics
     */
    getMetrics(): HealthMetrics {
        return { ...this.metrics };
    }

    /**
     * Get current state
     */
    getState(): SchedulerState {
        return this.state;
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create scheduler with environment configuration
 */
export function createScheduler(): SaraScheduler {
    return new SaraScheduler({
        cronExpression: process.env.SARA_PULSE_CRON || '*/30 * * * *',
        openAugiPath: process.env.SARA_OPENAUGI_PATH || './tests/sample-openaugi',
        dryRun: process.env.SARA_DRY_RUN !== 'false',
        useBrowser: process.env.SARA_USE_BROWSER === 'true',
        verbose: true,
    });
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
    const scheduler = SaraScheduler.getInstance();
    await scheduler.start();

    // Keep process alive
    await new Promise(() => { });
}

// Only run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error('Scheduler failed to start:', error);
        process.exit(1);
    });
}
