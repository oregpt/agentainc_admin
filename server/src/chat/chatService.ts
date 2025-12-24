import { db } from '../db/client';
import { agents, conversations, messages } from '../db/schema';
import { getRelevantContext } from '../rag/ragService';
import { getDefaultLLMProvider } from '../llm';
import { LLMMessage } from '../llm/types';
import { eq, desc } from 'drizzle-orm';

export async function ensureDefaultAgent(): Promise<string> {
  const existing = (await db.select().from(agents).limit(1)) as any[];
  if (existing.length) {
    return existing[0].id as string;
  }

  const inserted = (await db
    .insert(agents)
    .values({
      id: 'default-agent',
      slug: 'default',
      name: 'Agent-in-a-Box',
      defaultModel: process.env.CLAUDE_DEFAULT_MODEL || 'claude-3-5-sonnet-latest',
    })
    .returning()) as any[];

  return inserted[0].id as string;
}

export async function startConversation(agentId: string, externalUserId?: string, title?: string) {
  const rows = (await db
    .insert(conversations)
    .values({ agentId, externalUserId, title })
    .returning()) as any[];
  return rows[0];
}

export async function appendMessage(
  conversationId: number,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, unknown>
) {
  const rows = (await db
    .insert(messages)
    .values({ conversationId, role, content, metadata: metadata || {} })
    .returning()) as any[];

  return rows[0];
}

export async function getConversationWithMessages(conversationId: number) {
  const convRows = (await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)) as any[];

  const conv = convRows[0];
  if (!conv) return null;

  const msgRows = (await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.id))) as any[];

  return { conversation: conv, messages: msgRows.reverse() };
}

export async function generateReply(
  conversationId: number,
  userMessage: string
): Promise<{ reply: string; sources: { content: string; sourceTitle: string }[] }> {
  const provider = getDefaultLLMProvider();

  const conv = await getConversationWithMessages(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const agentId = conv.conversation.agentId as string;

  const rag = await getRelevantContext(agentId, userMessage, 2000);

  const history: LLMMessage[] = [];

  history.push({
    role: 'system',
    content:
      'You are an Agent-in-a-Box assistant. Use the provided context when it is relevant and cite sources in your answer.',
  });

  for (const m of conv.messages as any[]) {
    const role = (m.role as 'user' | 'assistant' | 'system') || 'user';
    history.push({ role, content: m.content as string });
  }

  history.push({ role: 'user', content: userMessage + (rag.context ? `\n\nContext:\n${rag.context}` : '') });

  const reply = await provider.generate(history, {
    model: process.env.CLAUDE_DEFAULT_MODEL || 'claude-3-5-sonnet-latest',
    maxTokens: 1024,
  });

  await appendMessage(conversationId, 'assistant', reply, { sources: rag.sources });

  const sources = rag.sources.map((s) => ({ content: s.content, sourceTitle: s.sourceTitle }));

  return { reply, sources };
}

export async function streamReply(
  conversationId: number,
  userMessage: string,
  onChunk: (delta: string, isFinal: boolean) => void
): Promise<{ full: string; sources: { content: string; sourceTitle: string }[] }> {
  const provider = getDefaultLLMProvider();

  const conv = await getConversationWithMessages(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const agentId = conv.conversation.agentId as string;

  const rag = await getRelevantContext(agentId, userMessage, 2000);

  const history: LLMMessage[] = [];

  history.push({
    role: 'system',
    content:
      'You are an Agent-in-a-Box assistant. Use the provided context when it is relevant and cite sources in your answer.',
  });

  for (const m of conv.messages as any[]) {
    const role = (m.role as 'user' | 'assistant' | 'system') || 'user';
    history.push({ role, content: m.content as string });
  }

  history.push({ role: 'user', content: userMessage + (rag.context ? `\n\nContext:\n${rag.context}` : '') });

  let full = '';

  await provider.stream(
    history,
    {
      model: process.env.CLAUDE_DEFAULT_MODEL || 'claude-3-5-sonnet-latest',
      maxTokens: 1024,
    },
    (chunk) => {
      if (chunk.type === 'delta') {
        full += chunk.content;
        onChunk(chunk.content, false);
      } else if (chunk.type === 'final') {
        // final chunk already accumulated in full
      }
    }
  );

  await appendMessage(conversationId, 'assistant', full, { sources: rag.sources });

  const sources = rag.sources.map((s) => ({ content: s.content, sourceTitle: s.sourceTitle }));

  return { full, sources };
}
