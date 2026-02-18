/**
 * Sara CUA - Output Exporter
 * 
 * Generates deliverables from CUA sessions.
 * PDF reports, XLSX spreadsheets, screenshots.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================
// TYPES
// ============================================

/**
 * Export format types
 */
export type ExportFormat = 'pdf' | 'xlsx' | 'json' | 'markdown' | 'html';

/**
 * Export request
 */
export interface ExportRequest {
    /** Export format */
    format: ExportFormat;

    /** Output filename (without extension) */
    filename: string;

    /** Title for the export */
    title: string;

    /** Data to export */
    data: ExportData;

    /** Optional metadata */
    metadata?: Record<string, string>;
}

/**
 * Data structure for exports
 */
export interface ExportData {
    /** Table data (for spreadsheets) */
    tables?: TableData[];

    /** Text sections (for reports) */
    sections?: ReportSection[];

    /** Raw JSON data */
    raw?: unknown;

    /** Screenshot paths to include */
    screenshots?: string[];
}

/**
 * Table data for spreadsheet exports
 */
export interface TableData {
    /** Sheet/table name */
    name: string;

    /** Column headers */
    headers: string[];

    /** Row data */
    rows: (string | number | boolean | null)[][];
}

/**
 * Report section for document exports
 */
export interface ReportSection {
    /** Section heading */
    heading: string;

    /** Section content (markdown) */
    content: string;

    /** Optional level (1-3) */
    level?: number;
}

/**
 * Export result
 */
export interface ExportResult {
    /** Whether export succeeded */
    success: boolean;

    /** Output file path */
    path: string;

    /** File size in bytes */
    sizeBytes?: number;

    /** Error if failed */
    error?: string;

    /** Timestamp */
    exportedAt: Date;
}

/**
 * Exporter configuration
 */
export interface ExporterConfig {
    /** Output directory */
    outputDir: string;

    /** Company/brand name for reports */
    brandName: string;

    /** Include timestamp in filename */
    timestampFilenames: boolean;

    /** Verbose logging */
    verbose: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: ExporterConfig = {
    outputDir: '/home/node/saraclaw/outputs',
    brandName: 'SomaVerso',
    timestampFilenames: true,
    verbose: false,
};

// ============================================
// OUTPUT EXPORTER
// ============================================

/**
 * Output Exporter
 * 
 * Generates deliverables from CUA sessions.
 */
export class OutputExporter {
    private config: ExporterConfig;

    constructor(config: Partial<ExporterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Export data to specified format
     */
    async export(request: ExportRequest): Promise<ExportResult> {
        const timestamp = this.config.timestampFilenames
            ? `-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`
            : '';

        const ext = this.getExtension(request.format);
        const filename = `${request.filename}${timestamp}.${ext}`;
        const outputPath = path.join(this.config.outputDir, filename);

        try {
            // Ensure output directory exists
            await fs.mkdir(this.config.outputDir, { recursive: true });

            let content: string | Buffer;

            switch (request.format) {
                case 'json':
                    content = this.exportJSON(request);
                    break;
                case 'markdown':
                    content = this.exportMarkdown(request);
                    break;
                case 'html':
                    content = this.exportHTML(request);
                    break;
                case 'pdf':
                    content = this.exportPDFPlaceholder(request);
                    break;
                case 'xlsx':
                    content = this.exportXLSXPlaceholder(request);
                    break;
                default:
                    throw new Error(`Unsupported format: ${request.format}`);
            }

            await fs.writeFile(outputPath, content);

            const stats = await fs.stat(outputPath);

            this.log(`✅ Exported: ${outputPath} (${stats.size} bytes)`);

            return {
                success: true,
                path: outputPath,
                sizeBytes: stats.size,
                exportedAt: new Date(),
            };
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            this.log(`❌ Export failed: ${error}`);

            return {
                success: false,
                path: outputPath,
                error,
                exportedAt: new Date(),
            };
        }
    }

    /**
     * Export as JSON
     */
    private exportJSON(request: ExportRequest): string {
        const output = {
            title: request.title,
            exportedAt: new Date().toISOString(),
            metadata: request.metadata,
            data: request.data,
        };
        return JSON.stringify(output, null, 2);
    }

    /**
     * Export as Markdown
     */
    private exportMarkdown(request: ExportRequest): string {
        const lines: string[] = [
            `# ${request.title}`,
            '',
            `*Exported by ${this.config.brandName} on ${new Date().toLocaleString('pt-BR')}*`,
            '',
        ];

        // Add metadata
        if (request.metadata) {
            lines.push('## Metadata', '');
            for (const [key, value] of Object.entries(request.metadata)) {
                lines.push(`- **${key}**: ${value}`);
            }
            lines.push('');
        }

        // Add sections
        if (request.data.sections) {
            for (const section of request.data.sections) {
                const hashes = '#'.repeat(section.level || 2);
                lines.push(`${hashes} ${section.heading}`, '', section.content, '');
            }
        }

        // Add tables
        if (request.data.tables) {
            for (const table of request.data.tables) {
                lines.push(`## ${table.name}`, '');
                lines.push(`| ${table.headers.join(' | ')} |`);
                lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);
                for (const row of table.rows) {
                    lines.push(`| ${row.map(cell => cell ?? '').join(' | ')} |`);
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    }

    /**
     * Export as HTML
     */
    private exportHTML(request: ExportRequest): string {
        const markdown = this.exportMarkdown(request);

        // Simple markdown to HTML conversion
        let html = markdown
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>');

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${request.title} - ${this.config.brandName}</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #0a0a0a; color: #e0e0e0; }
        h1, h2, h3 { color: #10b981; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #333; padding: 10px; text-align: left; }
        th { background: #1a1a1a; color: #fbbf24; }
        code { background: #1a1a1a; padding: 2px 6px; border-radius: 4px; }
    </style>
</head>
<body>
    <p>${html}</p>
</body>
</html>`;
    }

    /**
     * Placeholder for PDF export (requires external library)
     */
    private exportPDFPlaceholder(request: ExportRequest): string {
        // In production, use puppeteer or pdfkit
        // For now, export as HTML with PDF notice
        return this.exportHTML({
            ...request,
            title: `[PDF Placeholder] ${request.title}`,
        });
    }

    /**
     * Placeholder for XLSX export (requires external library)
     */
    private exportXLSXPlaceholder(request: ExportRequest): string {
        // In production, use xlsx or exceljs
        // For now, export as JSON with notice
        return JSON.stringify({
            notice: 'XLSX export requires xlsx library. Data exported as JSON.',
            ...request,
        }, null, 2);
    }

    /**
     * Get file extension for format
     */
    private getExtension(format: ExportFormat): string {
        switch (format) {
            case 'pdf': return 'html'; // Placeholder
            case 'xlsx': return 'json'; // Placeholder
            case 'markdown': return 'md';
            default: return format;
        }
    }

    /**
     * Create a consultancy report
     */
    async createConsultancyReport(params: {
        title: string;
        client: string;
        findings: ReportSection[];
        recommendations: string[];
        data?: TableData[];
    }): Promise<ExportResult> {
        const sections: ReportSection[] = [
            { heading: 'Executive Summary', content: `Report prepared for ${params.client}`, level: 2 },
            ...params.findings,
            {
                heading: 'Recommendations',
                content: params.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n'),
                level: 2,
            },
        ];

        return this.export({
            format: 'markdown',
            filename: `report-${params.client.toLowerCase().replace(/\s+/g, '-')}`,
            title: params.title,
            data: {
                sections,
                tables: params.data,
            },
            metadata: {
                client: params.client,
                preparedBy: this.config.brandName,
            },
        });
    }

    /**
     * Log if verbose
     */
    private log(message: string): void {
        if (this.config.verbose) {
            console.log(`[OutputExporter] ${message}`);
        }
    }
}

// ============================================
// FACTORY
// ============================================

/**
 * Create an Output Exporter instance
 */
export function createOutputExporter(config?: Partial<ExporterConfig>): OutputExporter {
    return new OutputExporter(config);
}
