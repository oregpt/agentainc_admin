export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMStreamChunk {
  type: 'delta' | 'final';
  content: string;
}

export interface GenerateOptions {
  model: string;
  maxTokens?: number;
}

export interface StreamOptions extends GenerateOptions {}

export interface LLMProvider {
  id: string;
  generate(messages: LLMMessage[], options: GenerateOptions): Promise<string>;
  stream(
    messages: LLMMessage[],
    options: StreamOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void>;
}
