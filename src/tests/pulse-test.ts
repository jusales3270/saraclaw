/**
 * Sara First Pulse Test - "Primeira Palavra"
 * 
 * Forces a complete heartbeat cycle to test the integration:
 * IDLE → REFLEXION → ACTION → Output
 * 
 * Usage: npm run pulse:test -- --topic="Soberania Digital"
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

// ============================================
// CONFIGURATION
// ============================================

interface PulseTestConfig {
    topic: string;
    openAugiPath: string;
    dryRun: boolean;
    verbose: boolean;
}

function parseArgs(): PulseTestConfig {
    const args = process.argv.slice(2);
    const config: PulseTestConfig = {
        topic: 'Soberania Digital',
        openAugiPath: process.env.SARA_OPENAUGI_PATH || './tests/sample-openaugi',
        dryRun: false,
        verbose: true,
    };

    for (const arg of args) {
        if (arg.startsWith('--topic=')) {
            config.topic = arg.slice(8).replace(/"/g, '');
        } else if (arg.startsWith('--openaugi=')) {
            config.openAugiPath = arg.slice(11);
        } else if (arg === '--dry-run') {
            config.dryRun = true;
        } else if (arg === '--quiet') {
            config.verbose = false;
        }
    }

    return config;
}

// ============================================
// LOGGING UTILITIES
// ============================================

type LogPhase = 'HEARTBEAT' | 'REFLEXION' | 'BRAIN' | 'ACTION' | 'SHIELD' | 'OUTPUT';

function log(phase: LogPhase, message: string, verbose: boolean = true): void {
    if (!verbose) return;

    const colors: Record<LogPhase, string> = {
        HEARTBEAT: '\x1b[35m', // Magenta
        REFLEXION: '\x1b[36m', // Cyan
        BRAIN: '\x1b[33m',     // Yellow
        ACTION: '\x1b[34m',    // Blue
        SHIELD: '\x1b[31m',    // Red
        OUTPUT: '\x1b[32m',    // Green
    };

    const reset = '\x1b[0m';
    console.log(`${colors[phase]}[${phase}]${reset}: ${message}`);
}

// ============================================
// SIMPLE CONTEXT ENRICHER (inline for testing)
// ============================================

interface SimpleEnrichedContext {
    query: string;
    historicalContext: string;
    sources: { title: string; path: string; relevance: number }[];
    enrichedAt: Date;
}

function findMarkdownFiles(dir: string): string[] {
    const files: string[] = [];

    if (!existsSync(dir)) {
        return files;
    }

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findMarkdownFiles(fullPath));
        } else if (entry.name.endsWith('.md')) {
            files.push(fullPath);
        }
    }

    return files;
}

function searchMarkdownFiles(
    files: string[],
    query: string,
    maxResults: number = 3
): SimpleEnrichedContext {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const results: { path: string; title: string; content: string; score: number }[] = [];

    for (const file of files) {
        try {
            const content = readFileSync(file, 'utf-8');
            const lowerContent = content.toLowerCase();

            // Calculate relevance score
            let score = 0;
            for (const word of queryWords) {
                const matches = lowerContent.split(word).length - 1;
                score += matches;
            }

            if (score > 0) {
                // Extract title from frontmatter or first heading
                const titleMatch = content.match(/^title:\s*(.+)$/m) || content.match(/^#\s+(.+)$/m);
                const title = titleMatch ? titleMatch[1].trim() : file.split(/[/\\]/).pop() || 'Untitled';

                results.push({ path: file, title, content, score });
            }
        } catch (error) {
            // Skip unreadable files
        }
    }

    // Sort by score and take top results
    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, maxResults);

    // Build historical context (limited to prevent context saturation)
    const contextParts: string[] = [];
    let totalChars = 0;
    const maxChars = 2000; // Prevent context saturation

    for (const result of topResults) {
        const excerpt = result.content.slice(0, 500);
        if (totalChars + excerpt.length > maxChars) break;
        contextParts.push(`### ${result.title}\n${excerpt}...`);
        totalChars += excerpt.length;
    }

    return {
        query,
        historicalContext: contextParts.join('\n\n'),
        sources: topResults.map(r => ({
            title: r.title,
            path: r.path,
            relevance: Math.min(1, r.score / 10),
        })),
        enrichedAt: new Date(),
    };
}

// ============================================
// SIMPLE CENSOR (inline for testing)
// ============================================

interface SimpleCensorResult {
    hasSensitiveData: boolean;
    censoredOutput: string;
    patterns: string[];
}

const sensitivePatterns = [
    { name: 'api_key', pattern: /sk-[a-zA-Z0-9]{20,}/gi },
    { name: 'cpf', pattern: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g },
    { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { name: 'password', pattern: /(password|senha)\s*[=:]\s*['"]?[^'"\\s]+/gi },
];

function censorOutput(output: string): SimpleCensorResult {
    let censored = output;
    const matchedPatterns: string[] = [];

    for (const { name, pattern } of sensitivePatterns) {
        const matches = output.match(pattern);
        if (matches && matches.length > 0) {
            matchedPatterns.push(name);
            censored = censored.replace(pattern, '[REDACTED]');
        }
    }

    return {
        hasSensitiveData: matchedPatterns.length > 0,
        censoredOutput: censored,
        patterns: matchedPatterns,
    };
}

// ============================================
// SIMULATED BROWSER SEARCH
// ============================================

interface NewsItem {
    title: string;
    source: string;
    date: string;
    summary: string;
}

async function simulateBrowserSearch(topic: string): Promise<NewsItem[]> {
    log('ACTION', `Pesquisando novidades sobre "${topic}"...`, true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return [
        {
            title: `Novo vazamento de dados em serviço de nuvem confirma fragilidades`,
            source: 'TechCrunch',
            date: '2026-02-03',
            summary: 'Milhões de registros expostos devido a configuração incorreta de APIs públicas.',
        },
        {
            title: `Protocolo MCP ganha tração como padrão para IA local`,
            source: 'Hacker News',
            date: '2026-02-04',
            summary: 'Model Context Protocol permite que modelos de IA rodem localmente sem depender de APIs de nuvem.',
        },
        {
            title: `Governos europeus avançam em leis de soberania digital`,
            source: 'The Verge',
            date: '2026-02-02',
            summary: 'GDPR 2.0 propõe que dados de cidadãos sejam processados apenas em servidores locais.',
        },
    ];
}

// ============================================
// INSIGHT SYNTHESIS
// ============================================

function generateInsight(
    topic: string,
    context: SimpleEnrichedContext,
    news: NewsItem[]
): string {
    const hasNotes = context.sources.length > 0;
    const hasNews = news.length > 0;

    if (hasNotes && hasNews) {
        return `Em suas notas anteriores sobre ${topic}, você expressou preocupações sobre a fragilidade das APIs de nuvem. ` +
            `Os eventos recentes (${news[0].title}) confirmam suas observações. ` +
            `Minha própria arquitetura - local, segura e autônoma - é a prova de que estávamos certos.`;
    }

    if (hasNotes && !hasNews) {
        return `Encontrei ${context.sources.length} notas suas sobre ${topic}, mas não há novidades relevantes no momento. Continuarei monitorando.`;
    }

    if (!hasNotes && hasNews) {
        return `Não encontrei notas anteriores sobre ${topic}, mas há notícias interessantes: ${news[0].title}. ` +
            `Talvez valha a pena documentar suas reflexões sobre isso.`;
    }

    return `Sem contexto disponível sobre ${topic}. Aguardando mais informações.`;
}

// ============================================
// MAIN PULSE TEST
// ============================================

async function runPulseTest(config: PulseTestConfig): Promise<void> {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('             SARA - PRIMEIRA PALAVRA (Pulse Test)          ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Tópico: "${config.topic}"`);
    console.log(`OpenAugi: ${resolve(config.openAugiPath)}`);
    console.log(`Dry Run: ${config.dryRun}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    const cycleId = `cycle-${Date.now()}`;
    const states: string[] = ['IDLE'];

    // ============================================
    // PHASE 1: HEARTBEAT AWAKENS
    // ============================================
    log('HEARTBEAT', 'Sara está acordando... ❤️', config.verbose);
    log('HEARTBEAT', `Ciclo iniciado: ${cycleId}`, config.verbose);

    // Transition to REFLEXION
    states.push('REFLEXION');
    log('HEARTBEAT', `Estado: IDLE → REFLEXION`, config.verbose);

    // ============================================
    // PHASE 2: SEARCH OPENAUGI
    // ============================================
    log('REFLEXION', `Buscando contexto em OpenAugi para "${config.topic}"...`, config.verbose);

    const openAugiPath = resolve(config.openAugiPath);
    const mdFiles = findMarkdownFiles(openAugiPath);
    const enrichedContext = searchMarkdownFiles(mdFiles, config.topic, 3);

    log('BRAIN', `Encontradas ${enrichedContext.sources.length} notas relacionadas.`, config.verbose);

    if (enrichedContext.sources.length > 0) {
        for (const source of enrichedContext.sources) {
            log('BRAIN', `  📄 ${source.title} (relevância: ${(source.relevance * 100).toFixed(0)}%)`, config.verbose);
        }
    } else {
        log('BRAIN', '  ⚠️ Nenhuma nota encontrada. Verifique o caminho do OpenAugi.', config.verbose);
    }

    // ============================================
    // PHASE 3: ACTION - BROWSER SEARCH
    // ============================================
    states.push('ACTION');
    log('ACTION', 'Transicionando para ACTION...', config.verbose);

    const news = await simulateBrowserSearch(config.topic);
    log('ACTION', `Encontradas ${news.length} notícias relevantes.`, config.verbose);

    // Generate insight
    const insight = generateInsight(config.topic, enrichedContext, news);

    // ============================================
    // PHASE 4: SHIELD - CENSOR OUTPUT
    // ============================================
    log('SHIELD', 'Verificando saída pelo The Censor...', config.verbose);

    const censorResult = censorOutput(insight);

    if (censorResult.hasSensitiveData) {
        log('SHIELD', `⚠️ ALERTA: ${censorResult.patterns.length} padrão(ões) sensível(is) detectado(s)!`, config.verbose);
        for (const pattern of censorResult.patterns) {
            log('SHIELD', `  🚫 ${pattern}`, config.verbose);
        }
    } else {
        log('SHIELD', '✅ Saída verificada. Nenhum dado sensível detectado.', config.verbose);
    }

    // ============================================
    // PHASE 5: OUTPUT
    // ============================================
    states.push('OUTPUT');

    console.log('\n');
    log('OUTPUT', '═══════════════════════════════════════════════════════════', config.verbose);
    log('OUTPUT', '                    MENSAGEM PARA O OPERADOR                ', config.verbose);
    log('OUTPUT', '═══════════════════════════════════════════════════════════', config.verbose);
    console.log('\n');
    console.log(censorResult.censoredOutput);
    console.log('\n');
    log('OUTPUT', `Fontes: ${enrichedContext.sources.length} notas + ${news.length} notícias`, config.verbose);

    // ============================================
    // SUMMARY
    // ============================================
    states.push('IDLE');

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                         RESUMO                            ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Ciclo: ${cycleId}`);
    console.log(`Estados percorridos: ${states.join(' → ')}`);
    console.log(`Ação tomada: SIM`);
    console.log(`Notas consultadas: ${enrichedContext.sources.length}`);
    console.log(`Notícias buscadas: ${news.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

// ============================================
// ENTRY POINT
// ============================================

const config = parseArgs();
runPulseTest(config).catch((error: Error) => {
    console.error('Erro no teste do pulso:', error);
    process.exit(1);
});
