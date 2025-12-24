import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { deleteDocument, ingestTextDocument, listDocuments, ingestFileDocument } from '../kb/kbService';
import { ensureDefaultAgent } from '../chat/chatService';
import { extractTextFromFile } from '../kb/fileExtractor';

type FileUploadRequest = Request & {
  file?: Express.Multer.File;
};

export const kbRouter = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'kb');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

kbRouter.post('/text', async (req, res) => {
  try {
    const agentId = (req.body.agentId as string) || (await ensureDefaultAgent());
    const title = String(req.body.title || 'Untitled');
    const text = String(req.body.text || '');
    if (!text.trim()) return res.status(400).json({ error: 'text is required' });

    const doc = await ingestTextDocument(agentId, title, text, req.body.metadata || {});
    res.json({ document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to ingest text document' });
  }
});

kbRouter.get('/', async (req, res) => {
  try {
    const agentId = (req.query.agentId as string) || (await ensureDefaultAgent());
    const docs = await listDocuments(agentId);
    res.json({ documents: docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

kbRouter.delete('/:documentId', async (req, res) => {
  try {
    const id = Number(req.params.documentId);
    await deleteDocument(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

kbRouter.post('/files', upload.single('file'), async (req, res) => {
  const typedReq = req as FileUploadRequest;
  try {
    if (!typedReq.file) return res.status(400).json({ error: 'file is required' });

    const agentId = (typedReq.body.agentId as string) || (await ensureDefaultAgent());
    const title = String(typedReq.body.title || typedReq.file.originalname || 'Untitled');
    const mimeType = typedReq.file.mimetype || 'application/octet-stream';

    const extracted = await extractTextFromFile(typedReq.file.path, mimeType);

    const doc = await ingestFileDocument(
      agentId,
      title,
      extracted.mimeType,
      extracted.size,
      extracted.content,
      typedReq.body.metadata || {}
    );

    res.json({ document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to ingest file document' });
  }
});
