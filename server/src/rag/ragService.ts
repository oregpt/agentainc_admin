import OpenAI from 'openai';
import { db } from '../db/client';
import { documentChunks, documents } from '../db/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing-key' });

export interface SimilarChunk {
  content: string;
  documentId: number;
  sourceTitle: string;
  similarity: number;
}

export function splitTextIntoChunks(text: string, maxChunkSize = 1000, overlap = 200): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];

  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if ((current + trimmed).length + 1 <= maxChunkSize) {
      current += (current ? '. ' : '') + trimmed;
    } else {
      if (current) chunks.push(current + '.');
      if (overlap > 0 && chunks.length > 0) {
        const last = chunks[chunks.length - 1] ?? '';
        const overlapText = last.slice(-overlap);
        current = overlapText + '. ' + trimmed;
      } else {
        current = trimmed;
      }
    }
  }

  if (current) chunks.push(current + '.');

  return chunks.filter((c) => c.trim().length > 0);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const clean = text.trim();
  if (!clean) throw new Error('Cannot embed empty text');

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: clean,
  });

  return response.data[0]?.embedding || [];
}

export async function indexDocument(agentId: string, documentId: number, content: string): Promise<void> {
  const chunks = splitTextIntoChunks(content);

  const values = await Promise.all(
    chunks.map(async (chunk, index) => {
      const embedding = await generateEmbedding(chunk);
      return {
        documentId,
        agentId,
        chunkIndex: index,
        content: chunk,
        embedding: JSON.stringify(embedding),
        tokenCount: Math.ceil(chunk.length / 4),
      };
    })
  );

  if (values.length) {
    await db.insert(documentChunks).values(values as any);
  }
}

export async function search(
  agentId: string,
  query: string,
  limit = 5,
  maxTokens = 3000
): Promise<SimilarChunk[]> {
  const queryEmbedding = await generateEmbedding(query);

  const rows = await db
    .select({
      id: documentChunks.id,
      documentId: documentChunks.documentId,
      content: documentChunks.content,
      embedding: documentChunks.embedding,
    })
    .from(documentChunks)
    .where(eq(documentChunks.agentId, agentId));

  if (!rows.length) return [];

  const docRows = await db.select().from(documents);
  const docMap = new Map<number, string>();
  for (const d of docRows as any[]) {
    docMap.set(d.id as number, d.title as string);
  }

  function cosine(a: number[], b: number[]): number {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      dot += av * bv;
      na += av * av;
      nb += bv * bv;
    }
    const mag = Math.sqrt(na) * Math.sqrt(nb);
    return mag === 0 ? 0 : dot / mag;
  }

  const scored = rows.map((row) => {
    const embedding = JSON.parse(row.embedding || '[]') as number[];
    const sim = cosine(queryEmbedding, embedding);
    return {
      content: row.content,
      documentId: row.documentId,
      sourceTitle: docMap.get(row.documentId) || 'Unknown source',
      similarity: sim,
    } as SimilarChunk;
  });

  scored.sort((a, b) => b.similarity - a.similarity);

  const results: SimilarChunk[] = [];
  let tokens = 0;

  for (const item of scored) {
    const t = Math.ceil(item.content.length / 4);
    if (results.length < limit && tokens + t <= maxTokens) {
      results.push(item);
      tokens += t;
    }
  }

  return results;
}

export async function getRelevantContext(
  agentId: string,
  query: string,
  maxTokens = 2000
): Promise<{ context: string; sources: SimilarChunk[] }> {
  const chunks = await search(agentId, query, 10, maxTokens);

  let context = '';
  for (const c of chunks) {
    context += `\n\n--- From ${c.sourceTitle} ---\n${c.content}`;
  }

  return { context, sources: chunks };
}
