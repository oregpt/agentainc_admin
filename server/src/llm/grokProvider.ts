import OpenAI from 'openai';
import { LLMMessage, LLMProvider, GenerateOptions, StreamOptions, LLMStreamChunk } from './types';

const xaiApiKey = process.env.XAI_API_KEY;

if (!xaiApiKey) {
  console.warn('[agentinabox-llm] XAI_API_KEY is not set. Grok provider will not work until configured.');
}

const client = new OpenAI({
  apiKey: xaiApiKey || 'missing-key',
  baseURL: 'https://api.x.ai/v1',
});

export class GrokProvider implements LLMProvider {
  id = 'grok';

  async generate(messages: LLMMessage[], options: GenerateOptions): Promise<string> {
    const model = options.model || 'grok-3-latest';

    const response = await client.chat.completions.create({
      model,
      max_tokens: options.maxTokens || 1024,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return response.choices[0]?.message?.content || '';
  }

  async stream(
    messages: LLMMessage[],
    options: StreamOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    const model = options.model || 'grok-3-latest';

    const stream = await client.chat.completions.create({
      model,
      max_tokens: options.maxTokens || 1024,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    });

    let full = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        full += delta;
        onChunk({ type: 'delta', content: delta });
      }
    }

    onChunk({ type: 'final', content: full });
  }
}
