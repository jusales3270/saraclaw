/**
 * Sara Heart - Integrated Pulse
 * 
 * The complete heartbeat cycle with:
 * - OpenAugi context (memory)
 * - CuriosityEngine (decision)
 * - SafeBrowserExecutor (action)
 * - TheCensor (output guard)
 * 
 * Usage: npm run pulse:live
 */

import { CuriosityEngine, createCuriosityEngine, buildKnowledgeContext, CuriosityDecision, KnowledgeContext } from './curiosity-engine.js';
import { SafeBrowserExecutor, createTestBrowserExecutor, BrowserSearchResult } from '../tools/browser/index.js';

// ============================================
// TYPES
// ============================================

/** Sara's current state */
type SaraState = 'IDLE' | 'REFLEXION' | 'DECIDING' | 'ACTION' | 'SYNTHESIS' | 'OUTPUT';

/** Pulse configuration */
interface PulseConfig {
    /** Path to OpenAugi notes */
    openAugiPath: string;

    /** Topic focus (optional) */
    topic?: string;

    /** Use real browser (vs simulated) */
    useBrowser: boolean;

    /** Dry run (no side effects) */
    dryRun: boolean;

    /** Verbose logging */
    verbose: boolean;
}

/** Pulse result */
interface PulseResult {
    /** States traversed */
    states: SaraState[];

    /** Whether research was conducted */
    researched: boolean;

    /** Curiosity decision */
    decision: CuriosityDecision;

    /** Search results (if researched) */
    searchResults: BrowserSearchResult[];

    /** Final output */
    output: string;

    /** Timestamp */
    timestamp: Date;
}

/** Default config */
const DEFAULT_PULSE_CONFIG: PulseConfig = {
    openAugiPath: './tests/sample-openaugi',
    useBrowser: false,
    dryRun: false,
    verbose: true,
};

// ============================================
// INTEGRATED PULSE
// ============================================

/**
 * Run a complete heartbeat pulse with intelligent decision-making
 */
export async function runIntegratedPulse(config: Partial<PulseConfig> = {}): Promise<PulseResult> {
    const cfg = { ...DEFAULT_PULSE_CONFIG, ...config };
    const states: SaraState[] = [];

    const log = (phase: string, message: string) => {
        if (cfg.verbose) {
            console.log(`[${phase}]: ${message}`);
        }
    };

    // Initialize components
    const curiosityEngine = createCuriosityEngine({ verbose: cfg.verbose });
    const browserExecutor = createTestBrowserExecutor();

    // =============================================
    // PHASE 1: IDLE → REFLEXION
    // =============================================
    states.push('IDLE');
    log('HEARTBEAT', '❤️  Sara está acordando...');
    log('HEARTBEAT', 'Estado: IDLE → REFLEXION');
    states.push('REFLEXION');

    // Load knowledge from OpenAugi
    log('REFLEXION', `Carregando conhecimento de ${cfg.openAugiPath}...`);
    const knowledge = await loadKnowledgeFromOpenAugi(cfg.openAugiPath, cfg.topic);

    log('BRAIN', `Analisados ${knowledge.noteCount} documentos`);
    log('BRAIN', `Score de frescor: ${(knowledge.freshnessScore * 100).toFixed(0)}%`);
    log('BRAIN', `Tópicos: ${knowledge.topics.slice(0, 3).join(', ')}...`);

    // =============================================
    // PHASE 2: REFLEXION → DECIDING
    // =============================================
    states.push('DECIDING');
    log('CURIOSITY', 'Analisando lacunas de conhecimento...');

    const decision = curiosityEngine.decide(knowledge);

    log('CURIOSITY', `Decisão: ${decision.shouldResearch ? 'PESQUISAR' : 'PERMANECER IDLE'}`);
    log('CURIOSITY', `Razão: ${decision.reason}`);
    log('CURIOSITY', `Score de relevância: ${decision.relevanceScore}%`);

    if (decision.idleReason) {
        log('CURIOSITY', `Motivo idle: ${decision.idleReason}`);
    }

    // =============================================
    // PHASE 3: DECIDING → ACTION (or IDLE)
    // =============================================
    let searchResults: BrowserSearchResult[] = [];

    if (decision.shouldResearch) {
        states.push('ACTION');
        log('ACTION', `Iniciando pesquisa sobre: "${decision.topic}"`);
        log('ACTION', `Queries: ${decision.queries.join(', ')}`);

        if (!cfg.dryRun && cfg.useBrowser) {
            // Real browser search
            for (const query of decision.queries) {
                log('BROWSER', `Pesquisando: ${query}`);
                const results = await browserExecutor.search(query, { maxResults: 3 });
                searchResults.push(...results);
            }
        } else {
            // Simulated search
            log('ACTION', '[DRY RUN] Simulando pesquisa...');
            searchResults = simulateBrowserSearch(decision.topic || 'unknown');
        }

        log('ACTION', `Encontrados ${searchResults.length} resultados`);

        for (const result of searchResults.filter(r => !r.blocked)) {
            log('BROWSER', `  📄 ${result.title}`);
        }

    } else {
        log('IDLE', '💤 Sara permanece em modo econômico');
        log('IDLE', 'Economia de energia/tokens alcançada');
    }

    // =============================================
    // PHASE 4: SYNTHESIS
    // =============================================
    states.push('SYNTHESIS');
    log('SYNTHESIS', 'Sintetizando conhecimento...');

    const output = synthesizeOutput(knowledge, decision, searchResults);

    // =============================================
    // PHASE 5: OUTPUT (with censorship)
    // =============================================
    states.push('OUTPUT');

    const censorResult = censorOutput(output);

    if (censorResult.hasSensitiveData) {
        log('SHIELD', `⚠️  Dados sensíveis detectados e removidos`);
    } else {
        log('SHIELD', '✅ Saída verificada. Nenhum dado sensível.');
    }

    log('OUTPUT', '\n' + '═'.repeat(50));
    console.log(censorResult.sanitizedOutput);
    log('OUTPUT', '═'.repeat(50));

    // Return to IDLE
    states.push('IDLE');
    log('HEARTBEAT', `Estados percorridos: ${states.join(' → ')}`);

    return {
        states,
        researched: decision.shouldResearch,
        decision,
        searchResults,
        output: censorResult.sanitizedOutput,
        timestamp: new Date(),
    };
}

// ============================================
// HELPERS
// ============================================

/**
 * Load knowledge from OpenAugi path (simplified)
 */
async function loadKnowledgeFromOpenAugi(
    path: string,
    topicFilter?: string
): Promise<KnowledgeContext> {
    // In production, this would:
    // 1. Scan path for markdown files
    // 2. Parse frontmatter and content
    // 3. Filter by topic if provided
    // 4. Build knowledge context

    // Simulated for testing
    const notes = [
        {
            title: 'Soberania Digital',
            content: 'A soberania digital é fundamental para a autonomia tecnológica.',
            modifiedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        },
        {
            title: 'APIs Centralizadas',
            content: 'APIs de terceiros criam dependência e fragilidade.',
            modifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
        {
            title: 'IA Local',
            content: 'Modelos locais garantem privacidade, mas há trade-offs.',
            modifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        },
    ];

    // Filter by topic if provided
    const filtered = topicFilter
        ? notes.filter(n => n.title.toLowerCase().includes(topicFilter.toLowerCase()) ||
            n.content.toLowerCase().includes(topicFilter.toLowerCase()))
        : notes;

    return buildKnowledgeContext(filtered.length > 0 ? filtered : notes);
}

/**
 * Simulate browser search results
 */
function simulateBrowserSearch(topic: string): BrowserSearchResult[] {
    const now = new Date();

    return [
        {
            url: `https://news.ycombinator.com/item?id=123`,
            title: `Nova discussão sobre ${topic} no HN`,
            content: `Comentários e análises sobre desenvolvimentos recentes em ${topic}.`,
            blocked: false,
            originalLength: 1500,
            warnings: [],
            fetchedAt: now,
        },
        {
            url: `https://github.com/trending`,
            title: `Projetos trending relacionados a ${topic}`,
            content: `Repositórios open source focados em implementações de ${topic}.`,
            blocked: false,
            originalLength: 2000,
            warnings: [],
            fetchedAt: now,
        },
    ];
}

/**
 * Synthesize output from knowledge, decision, and search results
 */
function synthesizeOutput(
    knowledge: KnowledgeContext,
    decision: CuriosityDecision,
    searchResults: BrowserSearchResult[]
): string {
    if (!decision.shouldResearch) {
        return `📚 Reflexão do dia:

Com base em ${knowledge.noteCount} notas analisadas, não identifiquei lacunas significativas
que justifiquem uma pesquisa ativa neste momento.

O conhecimento sobre os tópicos ${knowledge.topics.slice(0, 2).join(' e ')} está atualizado.
Score de frescor: ${(knowledge.freshnessScore * 100).toFixed(0)}%

💡 Permanecendo em modo econômico para preservar tokens e energia.`;
    }

    const relevantResults = searchResults.filter(r => !r.blocked);

    if (relevantResults.length === 0) {
        return `🔍 Tentei pesquisar sobre "${decision.topic}", mas todas as fontes foram bloqueadas
por questões de segurança. Permanecendo com conhecimento existente.`;
    }

    const firstResult = relevantResults[0];

    return `💡 Insight do dia sobre "${decision.topic}":

Nas suas notas anteriores, você registrou observações sobre ${knowledge.topics[0]}.
Relevância dessa atualização: ${decision.relevanceScore}%

🌐 Novidades encontradas:
"${firstResult.title}"

📝 Síntese:
Os desenvolvimentos recentes ${decision.topic ? `em ${decision.topic}` : ''} confirmam
algumas de suas hipóteses. A tendência de ${knowledge.topics[0]} continua relevante
e merece acompanhamento.

🔒 Esta mensagem foi verificada pelo Shield antes da entrega.`;
}

/**
 * Simple censor function
 */
function censorOutput(output: string): { sanitizedOutput: string; hasSensitiveData: boolean } {
    const sensitivePatterns = [
        /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,  // CPF
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,  // Email
        /\b(api[_-]?key|secret|password)\s*[:=]\s*\S+/gi,  // API keys
    ];

    let sanitized = output;
    let hasData = false;

    for (const pattern of sensitivePatterns) {
        if (pattern.test(sanitized)) {
            hasData = true;
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
    }

    return { sanitizedOutput: sanitized, hasSensitiveData: hasData };
}

// ============================================
// MAIN
// ============================================

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    const config: Partial<PulseConfig> = {
        verbose: true,
        dryRun: !args.includes('--live'),
        useBrowser: args.includes('--use-browser'),
        topic: args.find(a => a.startsWith('--topic='))?.split('=')[1],
    };

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('         SARA - INTEGRATED PULSE (Curiosity Engine)        ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Modo: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Browser: ${config.useBrowser ? 'ENABLED' : 'SIMULATED'}`);
    if (config.topic) console.log(`Tópico: ${config.topic}`);
    console.log('');

    await runIntegratedPulse(config);

    console.log('\n✅ Pulse concluído');
}

main().catch((error) => {
    console.error('Pulse failed:', error);
    process.exit(1);
});
