import Anthropic from '@anthropic-ai/sdk';
import { LLMMessage, LLMProvider, GenerateOptions, StreamOptions, LLMStreamChunk } from './types';
import { loadConfig } from '../config/appConfig';

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  console.warn('[agentinabox-llm] ANTHROPIC_API_KEY is not set. Claude provider will not work until configured.');
}

const client = new Anthropic({ apiKey: anthropicApiKey || 'missing-key' });

function toAnthropicMessages(messages: LLMMessage[]): Anthropic.Messages.MessageParam[] {
  // Anthropic expects a single system prompt and then user/assistant messages.
  // For simplicity, we extract the last system message (if any) and prepend it via system param.
  // The caller is responsible for building a good prompt.
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const system = systemParts.length ? systemParts.join('\n\n') : undefined;

  const nonSystem = messages.filter((m) => m.role !== 'system');

  return {
    system,
    messages: nonSystem.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  } as unknown as Anthropic.Messages.MessageParam[];
}

export class ClaudeProvider implements LLMProvider {
  id = 'claude';

  async generate(messages: LLMMessage[], options: GenerateOptions): Promise<string> {
    const config = loadConfig();
    const model = options.model || config.agents[0]?.defaultModel || 'claude-3-5-sonnet-latest';

    const { system, messages: coreMessages } = toAnthropicMessages(messages) as any;

    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens || 1024,
      system,
      messages: coreMessages,
    });

    const content = response.content
      .filter((c) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');

    return content;
  }

  async stream(
    messages: LLMMessage[],
    options: StreamOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    const config = loadConfig();
    const model = options.model || config.agents[0]?.defaultModel || 'claude-3-5-sonnet-latest';

    const { system, messages: coreMessages } = toAnthropicMessages(messages) as any;

    const stream = await client.messages.stream({
      model,
      max_tokens: options.maxTokens || 1024,
      system,
      messages: coreMessages,
    });

    let full = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const delta = event.delta.text || '';
        full += delta;
        onChunk({ type: 'delta', content: delta });
      }
    }

    onChunk({ type: 'final', content: full });
  }
}
