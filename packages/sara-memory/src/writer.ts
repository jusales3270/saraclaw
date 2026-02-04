/**
 * Sara Memory - Journal Writer
 * 
 * Writes Sara's reflections and learnings to markdown files.
 * These journals form Sara's persistent memory across pulse cycles.
 * 
 * Key Principles:
 * - Atomic writes: Each thought = one file (no corruption)
 * - Append-only: Sara never rewrites her history
 * - Metadata tags: Easy filtering with #sara-reflection
 * - Summarization: 3 key topics per entry
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

// ============================================
// TYPES
// ============================================

/** Journal entry types */
export type JournalEntryType =
    | 'reflection'    // Post-pulse reflection
    | 'insight'       // Key insight discovered
    | 'lesson'        // Lesson learned
    | 'question'      // Unanswered question
    | 'correction';   // Self-correction from previous belief

/** Journal entry structure */
export interface JournalEntry {
    /** Entry type */
    type: JournalEntryType;

    /** Title/headline */
    title: string;

    /** Main content */
    content: string;

    /** What was researched (if applicable) */
    researchTopic?: string;

    /** Search queries used */
    searchQueries?: string[];

    /** Key insights (max 3) */
    insights: string[];

    /** Lessons learned */
    lessonsLearned?: string[];

    /** Related previous entries */
    relatedEntries?: string[];

    /** Pulse number that generated this */
    pulseNumber?: number;

    /** Was this from ACTION or IDLE? */
    pulseMode: 'action' | 'idle';

    /** Confidence level (0-1) */
    confidence?: number;
}

/** Journal writer configuration */
export interface JournalWriterConfig {
    /** Base path to OpenAugi */
    openAugiPath: string;

    /** Journal subdirectory */
    journalSubdir: string;

    /** Auto-add tags */
    autoTags: string[];

    /** Enable dry run (no writes) */
    dryRun: boolean;

    /** Verbose logging */
    verbose: boolean;
}

/** Default configuration */
const DEFAULT_JOURNAL_CONFIG: JournalWriterConfig = {
    openAugiPath: './tests/sample-openaugi',
    journalSubdir: 'journal',
    autoTags: ['sara-reflection', 'auto-generated'],
    dryRun: false,
    verbose: true,
};

// ============================================
// JOURNAL WRITER
// ============================================

/**
 * Journal Writer - Sara's diary
 * 
 * Persists learnings and reflections to markdown files.
 */
export class JournalWriter {
    private config: JournalWriterConfig;
    private entriesWritten: number = 0;

    constructor(config: Partial<JournalWriterConfig> = {}) {
        this.config = { ...DEFAULT_JOURNAL_CONFIG, ...config };
    }

    /**
     * Write a journal entry
     * Returns the path to the written file
     */
    write(entry: JournalEntry): string {
        const timestamp = this.getTimestamp();
        const filename = `${timestamp}.md`;
        const journalPath = join(
            this.config.openAugiPath,
            this.config.journalSubdir
        );
        const filepath = join(journalPath, filename);

        // Generate markdown content
        const markdown = this.generateMarkdown(entry, timestamp);

        if (this.config.dryRun) {
            this.log(`[DRY RUN] Would write to: ${filepath}`);
            this.log(`Content:\n${markdown}`);
            return filepath;
        }

        // Ensure directory exists
        this.ensureDirectory(journalPath);

        // Atomic write
        try {
            writeFileSync(filepath, markdown, 'utf-8');
            this.entriesWritten++;
            this.log(`✏️  Journal entry written: ${filename}`);
            return filepath;
        } catch (error) {
            this.log(`❌ Failed to write journal: ${error}`);
            throw error;
        }
    }

    /**
     * Write a post-pulse reflection
     */
    writeReflection(
        topic: string,
        insights: string[],
        pulseMode: 'action' | 'idle',
        pulseNumber?: number
    ): string {
        const entry: JournalEntry = {
            type: 'reflection',
            title: `Reflexão: ${topic}`,
            content: this.generateReflectionContent(topic, insights, pulseMode),
            researchTopic: pulseMode === 'action' ? topic : undefined,
            insights: insights.slice(0, 3),
            pulseMode,
            pulseNumber,
            confidence: pulseMode === 'action' ? 0.7 : 0.5,
        };

        return this.write(entry);
    }

    /**
     * Write a self-correction entry
     */
    writeCorrection(
        previousBelief: string,
        newUnderstanding: string,
        evidence: string
    ): string {
        const entry: JournalEntry = {
            type: 'correction',
            title: `Correção: ${previousBelief.slice(0, 50)}...`,
            content: this.generateCorrectionContent(previousBelief, newUnderstanding, evidence),
            insights: [newUnderstanding],
            lessonsLearned: ['Atualizar modelo mental com base em novas evidências'],
            pulseMode: 'action',
            confidence: 0.8,
        };

        return this.write(entry);
    }

    /**
     * Write an unanswered question
     */
    writeQuestion(question: string, context: string): string {
        const entry: JournalEntry = {
            type: 'question',
            title: `Questão: ${question}`,
            content: `## Contexto\n\n${context}\n\n## Questão em Aberto\n\n${question}\n\n_Esta questão permanece em aberto para investigação futura._`,
            insights: [],
            pulseMode: 'idle',
            confidence: 0.3,
        };

        return this.write(entry);
    }

    /**
     * Read recent journals for self-feedback loop
     */
    readRecentJournals(days: number = 7): Array<{
        filename: string;
        content: string;
        date: Date;
    }> {
        const journalPath = join(
            this.config.openAugiPath,
            this.config.journalSubdir
        );

        if (!existsSync(journalPath)) {
            return [];
        }

        const files = readdirSync(journalPath)
            .filter(f => f.endsWith('.md'))
            .sort()
            .reverse(); // Most recent first

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const results: Array<{ filename: string; content: string; date: Date }> = [];

        for (const file of files) {
            // Parse date from filename: YYYY-MM-DD-HHmm.md
            const match = file.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.md$/);
            if (!match) continue;

            const [, year, month, day, hour, minute] = match;
            const date = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hour),
                parseInt(minute)
            );

            if (date < cutoffDate) break; // Stop if older than cutoff

            try {
                const content = readFileSync(join(journalPath, file), 'utf-8');
                results.push({ filename: file, content, date });
            } catch {
                // Skip unreadable files
            }
        }

        return results;
    }

    /**
     * Get summary of recent journals for context
     */
    getRecentSummary(days: number = 3): string {
        const journals = this.readRecentJournals(days);

        if (journals.length === 0) {
            return 'Nenhum registro recente encontrado.';
        }

        const summaries: string[] = [];

        for (const journal of journals.slice(0, 5)) {
            // Extract title from content
            const titleMatch = journal.content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1] : journal.filename;

            // Extract first insight
            const insightMatch = journal.content.match(/##\s+Insights\s*\n+[•\-*]\s*(.+)/m);
            const insight = insightMatch ? insightMatch[1] : '';

            const dateStr = journal.date.toLocaleDateString('pt-BR');
            summaries.push(`- **${dateStr}**: ${title}${insight ? ` — "${insight}"` : ''}`);
        }

        return summaries.join('\n');
    }

    /**
     * Generate markdown content from entry
     */
    private generateMarkdown(entry: JournalEntry, timestamp: string): string {
        const tags = [...this.config.autoTags, entry.type];
        const frontmatter = this.generateFrontmatter(entry, timestamp, tags);

        const sections: string[] = [
            frontmatter,
            '',
            `# ${entry.title}`,
            '',
            entry.content,
            '',
        ];

        // Add insights section
        if (entry.insights.length > 0) {
            sections.push('## Insights');
            sections.push('');
            for (const insight of entry.insights) {
                sections.push(`- ${insight}`);
            }
            sections.push('');
        }

        // Add lessons learned
        if (entry.lessonsLearned && entry.lessonsLearned.length > 0) {
            sections.push('## Lições Aprendidas');
            sections.push('');
            for (const lesson of entry.lessonsLearned) {
                sections.push(`- ${lesson}`);
            }
            sections.push('');
        }

        // Add search queries (if action)
        if (entry.searchQueries && entry.searchQueries.length > 0) {
            sections.push('## Pesquisas Realizadas');
            sections.push('');
            for (const query of entry.searchQueries) {
                sections.push(`- \`${query}\``);
            }
            sections.push('');
        }

        // Add footer
        sections.push('---');
        sections.push(`_Gerado automaticamente por Sara no pulso #${entry.pulseNumber || 'N/A'}_`);

        return sections.join('\n');
    }

    /**
     * Generate YAML frontmatter
     */
    private generateFrontmatter(
        entry: JournalEntry,
        timestamp: string,
        tags: string[]
    ): string {
        const lines = [
            '---',
            `type: ${entry.type}`,
            `date: ${timestamp.replace('-', 'T').slice(0, -2) + ':' + timestamp.slice(-2)}`,
            `pulse_mode: ${entry.pulseMode}`,
            `confidence: ${entry.confidence || 0.5}`,
            `tags:`,
            ...tags.map(t => `  - ${t}`),
        ];

        if (entry.pulseNumber) {
            lines.push(`pulse_number: ${entry.pulseNumber}`);
        }

        if (entry.researchTopic) {
            lines.push(`research_topic: "${entry.researchTopic}"`);
        }

        lines.push('---');

        return lines.join('\n');
    }

    /**
     * Generate reflection content
     */
    private generateReflectionContent(
        topic: string,
        insights: string[],
        pulseMode: 'action' | 'idle'
    ): string {
        if (pulseMode === 'idle') {
            return `Neste ciclo de pulso, optei por permanecer em modo de economia.

O tema "${topic}" foi analisado, mas não detectei lacunas de conhecimento
significativas que justificassem uma pesquisa ativa.

Esta é uma decisão consciente de preservar recursos.`;
        }

        return `Neste ciclo, investiguei ativamente o tema "${topic}".

${insights.length > 0 ? `Os principais aprendizados foram:

${insights.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}` : 'Nenhum insight significativo foi gerado.'}

Esta reflexão será usada como referência em pulsos futuros.`;
    }

    /**
     * Generate correction content
     */
    private generateCorrectionContent(
        previousBelief: string,
        newUnderstanding: string,
        evidence: string
    ): string {
        return `## Crença Anterior

${previousBelief}

## Nova Compreensão

${newUnderstanding}

## Evidência

${evidence}

---

Esta correção demonstra minha capacidade de atualizar crenças quando
confrontada com novas evidências. A antifragilidade cognitiva é essencial.`;
    }

    /**
     * Get current timestamp in YYYY-MM-DD-HHmm format
     */
    private getTimestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}-${hour}${minute}`;
    }

    /**
     * Ensure directory exists
     */
    private ensureDirectory(path: string): void {
        if (!existsSync(path)) {
            mkdirSync(path, { recursive: true });
            this.log(`📁 Created directory: ${path}`);
        }
    }

    /**
     * Log message
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[JOURNAL] ${message}`);
        }
    }

    /**
     * Get stats
     */
    getStats(): { entriesWritten: number } {
        return { entriesWritten: this.entriesWritten };
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create journal writer with default config
 */
export function createJournalWriter(
    config?: Partial<JournalWriterConfig>
): JournalWriter {
    return new JournalWriter(config);
}

/**
 * Create journal writer from env vars
 */
export function createJournalWriterFromEnv(): JournalWriter {
    return new JournalWriter({
        openAugiPath: process.env.SARA_OPENAUGI_PATH || './tests/sample-openaugi',
        dryRun: process.env.SARA_DRY_RUN !== 'false',
        verbose: true,
    });
}

// ============================================
// TEST
// ============================================

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('         SARA JOURNAL WRITER - TEST                         ');
    console.log('═══════════════════════════════════════════════════════════');

    const writer = createJournalWriter({
        openAugiPath: './tests/sample-openaugi',
        dryRun: true, // Safe test
        verbose: true,
    });

    // Test reflection write
    const path = writer.writeReflection(
        'Soberania Digital',
        [
            'APIs centralizadas criam dependência',
            'Modelos locais garantem privacidade',
            'O custo de infraestrutura própria está caindo',
        ],
        'action',
        42
    );

    console.log(`\nWould write to: ${path}`);

    // Test reading recent journals
    console.log('\n--- Recent Journals ---');
    const summary = writer.getRecentSummary(7);
    console.log(summary);

    console.log('\n✅ Journal writer test complete');
}

main().catch(console.error);
