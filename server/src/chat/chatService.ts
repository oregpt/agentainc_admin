import { db } from '../db/client';
import { agents, conversations, messages } from '../db/schema';
import { getRelevantContext } from '../rag/ragService';
import { getProviderForModel } from '../llm';
import { LLMMessage } from '../llm/types';
import { eq, desc } from 'drizzle-orm';
import { getOrchestrator } from '../mcp-hub';

// Command pattern: !command args or natural language tool requests
const COMMAND_PATTERN = /^!(\w+)\s+(.+)$/;

interface CapabilityResult {
  used: boolean;
  command?: string;
  result?: string;
  error?: string;
}

function buildCapabilityResult(
  command: string,
  success: boolean,
  data: unknown,
  errorMsg?: string
): CapabilityResult {
  const result: CapabilityResult = { used: true };
  result.command = command;
  if (success && data) {
    result.result = JSON.stringify(data, null, 2);
  }
  if (errorMsg) {
    result.error = errorMsg;
  }
  return result;
}

/**
 * Detect and execute capability commands from user message
 * Supports: !coingecko price bitcoin, !api call coingecko ...
 */
async function detectAndExecuteCapability(message: string): Promise<CapabilityResult> {
  const match = message.match(COMMAND_PATTERN);
  if (!match || !match[1] || !match[2]) {
    return { used: false };
  }

  const command = match[1].toLowerCase();
  const args = match[2];

  try {
    const orchestrator = getOrchestrator();

    // Route to AnyAPI for API commands
    if (command === 'api' || command === 'anyapi') {
      // Parse: !api call <apiId> <endpoint> [params]
      const apiMatch = args.match(/^call\s+(\w+)\s+(\w+)(?:\s+(.+))?$/i);
      if (apiMatch && apiMatch[1] && apiMatch[2]) {
        const apiId = apiMatch[1];
        const endpoint = apiMatch[2];
        const paramsStr = apiMatch[3];

        const queryParams: Record<string, string> = {};
        if (paramsStr) {
          // Parse key=value pairs
          paramsStr.split(/\s+/).forEach(pair => {
            const parts = pair.split('=');
            if (parts[0] && parts[1]) {
              queryParams[parts[0]] = parts[1];
            }
          });
        }

        const result = await orchestrator.executeAction('anyapi', 'call_api', { apiId, endpoint, queryParams });
        return buildCapabilityResult(`!api call ${apiId} ${endpoint}`, result.success, result.data, result.error);
      }
    }

    // CoinGecko shortcuts: !coingecko price bitcoin, !crypto price eth
    if (command === 'coingecko' || command === 'crypto') {
      const priceMatch = args.match(/^price\s+(\w+)/i);
      if (priceMatch && priceMatch[1]) {
        const coinId = priceMatch[1].toLowerCase();
        const result = await orchestrator.executeAction('anyapi', 'call_api', {
          apiId: 'coingecko',
          endpoint: 'simple_price',
          queryParams: { ids: coinId, vs_currencies: 'usd' },
        });
        return buildCapabilityResult(`!coingecko price ${coinId}`, result.success, result.data, result.error);
      }
    }

    // Weather shortcut: !weather <city>
    if (command === 'weather') {
      const city = args.trim();
      const result = await orchestrator.executeAction('anyapi', 'call_api', {
        apiId: 'openweather',
        endpoint: 'current_weather',
        queryParams: { q: city, units: 'metric' },
      });
      return buildCapabilityResult(`!weather ${city}`, result.success, result.data, result.error);
    }

    // List available APIs: !apis or !api list
    if (command === 'apis' || (command === 'api' && /^list/i.test(args))) {
      const result = await orchestrator.executeAction('anyapi', 'list_apis', {});
      return buildCapabilityResult('!api list', result.success, result.data, result.error);
    }

    return { used: false };
  } catch (error) {
    const errResult: CapabilityResult = { used: true };
    errResult.command = `!${command}`;
    errResult.error = error instanceof Error ? error.message : 'Unknown error';
    return errResult;
  }
}

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
      description: 'Default Agent-in-a-Box assistant',
      instructions:
        'You are an Agent-in-a-Box assistant. Use the knowledge base and tools when relevant and always cite your sources when you rely on retrieved documents.',
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
): Promise<{ reply: string; sources: { content: string; sourceTitle: string }[]; capabilityUsed?: string }> {
  const conv = await getConversationWithMessages(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const agentId = conv.conversation.agentId as string;

  // Check for capability commands first
  const capabilityResult = await detectAndExecuteCapability(userMessage);

  const rag = await getRelevantContext(agentId, userMessage, 2000);

  const history: LLMMessage[] = [];

  const agentRows = (await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)) as any[];
  const agent = agentRows[0];
  let systemInstructions =
    (agent?.instructions as string | null) ||
    'You are an Agent-in-a-Box assistant. Use the provided context when it is relevant and cite sources in your answer.';

  // Add capability awareness to system prompt
  systemInstructions += '\n\nYou can execute capability commands like !coingecko price bitcoin, !weather city, or !api call <id> <endpoint>. When a user uses these commands, format the results nicely.';

  history.push({
    role: 'system',
    content: systemInstructions,
  });

  for (const m of conv.messages as any[]) {
    const role = (m.role as 'user' | 'assistant' | 'system') || 'user';
    history.push({ role, content: m.content as string });
  }

  // Build user message with context
  let userContent = userMessage;
  if (rag.context) {
    userContent += `\n\nContext:\n${rag.context}`;
  }

  // If a capability was used, include its result
  if (capabilityResult.used) {
    if (capabilityResult.result) {
      userContent += `\n\nAPI Result (${capabilityResult.command}):\n${capabilityResult.result}`;
    } else if (capabilityResult.error) {
      userContent += `\n\nAPI Error (${capabilityResult.command}): ${capabilityResult.error}`;
    }
  }

  history.push({ role: 'user', content: userContent });

  const model =
    (agent?.defaultModel as string | null) ||
    process.env.DEFAULT_MODEL ||
    'claude-sonnet-4-20250514';

  const provider = getProviderForModel(model);

  const reply = await provider.generate(history, {
    model,
    maxTokens: 1024,
  });

  await appendMessage(conversationId, 'assistant', reply, {
    sources: rag.sources,
    capabilityUsed: capabilityResult.command,
  });

  const sources = rag.sources.map((s) => ({ content: s.content, sourceTitle: s.sourceTitle }));

  // Build return conditionally to satisfy exactOptionalPropertyTypes
  const returnVal: { reply: string; sources: { content: string; sourceTitle: string }[]; capabilityUsed?: string } = {
    reply,
    sources,
  };
  if (capabilityResult.command) {
    returnVal.capabilityUsed = capabilityResult.command;
  }
  return returnVal;
}

export async function streamReply(
  conversationId: number,
  userMessage: string,
  onChunk: (delta: string, isFinal: boolean) => void
): Promise<{ full: string; sources: { content: string; sourceTitle: string }[]; capabilityUsed?: string }> {
  const conv = await getConversationWithMessages(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const agentId = conv.conversation.agentId as string;

  // Check for capability commands first
  const capabilityResult = await detectAndExecuteCapability(userMessage);

  const rag = await getRelevantContext(agentId, userMessage, 2000);

  const history: LLMMessage[] = [];

  const agentRows = (await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)) as any[];
  const agent = agentRows[0];
  let systemInstructions =
    (agent?.instructions as string | null) ||
    'You are an Agent-in-a-Box assistant. Use the provided context when it is relevant and cite sources in your answer.';

  // Add capability awareness to system prompt
  systemInstructions += '\n\nYou can execute capability commands like !coingecko price bitcoin, !weather city, or !api call <id> <endpoint>. When a user uses these commands, format the results nicely.';

  history.push({
    role: 'system',
    content: systemInstructions,
  });

  for (const m of conv.messages as any[]) {
    const role = (m.role as 'user' | 'assistant' | 'system') || 'user';
    history.push({ role, content: m.content as string });
  }

  // Build user message with context
  let userContent = userMessage;
  if (rag.context) {
    userContent += `\n\nContext:\n${rag.context}`;
  }

  // If a capability was used, include its result
  if (capabilityResult.used) {
    if (capabilityResult.result) {
      userContent += `\n\nAPI Result (${capabilityResult.command}):\n${capabilityResult.result}`;
    } else if (capabilityResult.error) {
      userContent += `\n\nAPI Error (${capabilityResult.command}): ${capabilityResult.error}`;
    }
  }

  history.push({ role: 'user', content: userContent });

  const model =
    (agent?.defaultModel as string | null) ||
    process.env.DEFAULT_MODEL ||
    'claude-sonnet-4-20250514';

  const provider = getProviderForModel(model);

  let full = '';

  await provider.stream(
    history,
    {
      model,
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

  await appendMessage(conversationId, 'assistant', full, {
    sources: rag.sources,
    capabilityUsed: capabilityResult.command,
  });

  const sources = rag.sources.map((s) => ({ content: s.content, sourceTitle: s.sourceTitle }));

  // Build return conditionally to satisfy exactOptionalPropertyTypes
  const returnVal: { full: string; sources: { content: string; sourceTitle: string }[]; capabilityUsed?: string } = {
    full,
    sources,
  };
  if (capabilityResult.command) {
    returnVal.capabilityUsed = capabilityResult.command;
  }
  return returnVal;
}
