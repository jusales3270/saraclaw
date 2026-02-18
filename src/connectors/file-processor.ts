import mammoth from 'mammoth';
import * as pdfParseModule from 'pdf-parse';

// Handle default export compatibility
const pdfParse = (pdfParseModule as any).default || pdfParseModule;

/**
 * Extract text from various file formats
 */
export class FileProcessor {
    /**
     * Extract text based on MIME type
     */
    async extractText(buffer: Buffer, mimeType: string): Promise<string> {
        if (mimeType.includes('text/plain') || mimeType.includes('text/markdown')) {
            return buffer.toString('utf-8');
        }

        if (mimeType.includes('pdf')) {
            return this.extractPdf(buffer);
        }

        if (mimeType.includes('msword') || mimeType.includes('wordprocessingml')) {
            return this.extractDocx(buffer);
        }

        if (mimeType.includes('text/csv')) {
            return buffer.toString('utf-8');
        }

        // Fallback: try as text if it seems like text (less than 10MB)
        if (buffer.length < 10 * 1024 * 1024) {
            try {
                // Check for binary characters might be better, but basic attempt
                return buffer.toString('utf-8');
            } catch (e) { }
        }

        return '';
    }

    /**
     * Extract text from PDF
     */
    private async extractPdf(buffer: Buffer): Promise<string> {
        try {
            const data = await pdfParse(buffer);
            return data.text;
        } catch (error) {
            console.error('[FileProcessor] Error extracting PDF:', error);
            return '';
        }
    }

    /**
     * Extract text from DOCX
     */
    private async extractDocx(buffer: Buffer): Promise<string> {
        try {
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } catch (error) {
            console.error('[FileProcessor] Error extracting DOCX:', error);
            return '';
        }
    }
}
