import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMMessage, LLMProvider, GenerateOptions, StreamOptions, LLMStreamChunk } from './types';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('[agentinabox-llm] GEMINI_API_KEY is not set. Gemini provider will not work until configured.');
}

const genAI = new GoogleGenerativeAI(geminiApiKey || 'missing-key');

export class GeminiProvider implements LLMProvider {
  id = 'gemini';

  async generate(messages: LLMMessage[], options: GenerateOptions): Promise<string> {
    const modelName = options.model || 'gemini-2.5-flash-preview-05-20';
    const model = genAI.getGenerativeModel({ model: modelName });

    // Convert messages to Gemini format
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const history = chatMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];

    const chatOptions: any = { history };
    if (systemMessage?.content) {
      chatOptions.systemInstruction = systemMessage.content;
    }

    const chat = model.startChat(chatOptions);

    const result = await chat.sendMessage(lastMessage?.content || '');
    return result.response.text();
  }

  async stream(
    messages: LLMMessage[],
    options: StreamOptions,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    const modelName = options.model || 'gemini-2.5-flash-preview-05-20';
    const model = genAI.getGenerativeModel({ model: modelName });

    // Convert messages to Gemini format
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const history = chatMessages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const lastMessage = chatMessages[chatMessages.length - 1];

    const chatOptions: any = { history };
    if (systemMessage?.content) {
      chatOptions.systemInstruction = systemMessage.content;
    }

    const chat = model.startChat(chatOptions);

    const result = await chat.sendMessageStream(lastMessage?.content || '');

    let full = '';

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        full += text;
        onChunk({ type: 'delta', content: text });
      }
    }

    onChunk({ type: 'final', content: full });
  }
}
