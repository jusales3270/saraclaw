import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { VectorStore } from '../../../packages/sara-memory/src/vector-store.js';
import { FileProcessor } from '../../connectors/file-processor.js';

import { Router } from 'express';

const router: Router = express.Router();

// Multer config: disk storage with type validation
const upload = multer({
    dest: process.env.SARA_UPLOAD_TEMP_DIR || '/tmp/sara-uploads/',
    limits: {
        fileSize: (parseInt(process.env.SARA_MAX_UPLOAD_SIZE_MB || '10')) * 1024 * 1024, // 10MB default
        files: 10                    // Max 10 files at once
    },
    fileFilter: (req, file, cb) => {
        // H4 FIX: Strict extension validation (mimetype is user-controlled)
        const allowedExts = ['.txt', '.md', '.pdf', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de arquivo não permitido: ${ext}`));
        }
    }
});

const vectorStore = new VectorStore();
const fileProcessor = new FileProcessor();

/**
 * POST /api/ingest/file
 * Process uploaded file and add to OpenAugi
 */
router.post('/file', upload.single('file'), async (req: any, res: any) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const filePath = req.file.path;

    try {
        console.log(`[Ingest] Processing: ${req.file.originalname}`);

        // 1. Read file buffer
        const buffer = fs.readFileSync(filePath);

        // 2. Extract text
        const text = await fileProcessor.extractText(buffer, req.file.mimetype);

        if (!text || text.trim().length === 0) {
            return res.status(422).json({
                error: 'Não foi possível extrair texto do arquivo'
            });
        }

        // 3. Chunk text into atoms (max 500 chars each)
        const chunks = chunkText(text, 500);

        console.log(`[Ingest] ${chunks.length} chunks from ${req.file.originalname}`);

        // 4. Add each chunk to VectorStore
        let atomsCreated = 0;

        for (const chunk of chunks) {
            if (chunk.trim().length > 20) { // Skip tiny chunks
                await vectorStore.add(chunk, {
                    source: 'upload',
                    fileName: req.file.originalname,
                    fileType: req.file.mimetype,
                    tags: ['upload', 'onboarding']
                });
                atomsCreated++;
            }
        }

        res.json({
            success: true,
            fileName: req.file.originalname,
            atomsCreated,
            textLength: text.length
        });

    } catch (error: any) {
        console.error('[Ingest] Error:', error);
        res.status(500).json({ error: error.message });

    } finally {
        // Always clean up temp file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

/**
 * POST /api/ingest/text
 * Ingest raw text directly (for manual input)
 */
router.post('/text', async (req: any, res: any) => {
    const { content, source = 'manual', tags = [] } = req.body;

    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Conteúdo não pode estar vazio' });
    }

    try {
        const chunks = chunkText(content, 500);
        let atomsCreated = 0;

        for (const chunk of chunks) {
            if (chunk.trim().length > 20) {
                await vectorStore.add(chunk, { source, tags });
                atomsCreated++;
            }
        }

        res.json({ success: true, atomsCreated });

    } catch (error: any) {
        console.error('[Ingest] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ingest/stats
 * Get ingestion statistics
 */
router.get('/stats', async (req: any, res: any) => {
    try {
        const costs = await vectorStore.getEmbeddingCosts();

        res.json({
            totalAtoms: costs.totalTokens > 0 ? 'available' : 0,
            embeddingCosts: costs
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Split text into chunks respecting sentence boundaries
 */
function chunkText(text: string, maxChars: number): string[] {
    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        // If paragraph itself is too long, split by sentences
        if (paragraph.length > maxChars) {
            const sentences = paragraph.split(/[.!?]+\s+/);

            for (const sentence of sentences) {
                if ((currentChunk + sentence).length > maxChars && currentChunk) {
                    chunks.push(currentChunk.trim());
                    currentChunk = sentence + ' ';
                } else {
                    currentChunk += sentence + ' ';
                }
            }
        } else {
            if ((currentChunk + paragraph).length > maxChars && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = paragraph + '\n\n';
            } else {
                currentChunk += paragraph + '\n\n';
            }
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks.filter(c => c.length > 0);
}

export default router;
