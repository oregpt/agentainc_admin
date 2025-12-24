import { ClaudeProvider } from './claudeProvider';
import { LLMProvider } from './types';
import { loadConfig } from '../config/appConfig';

let cachedProvider: LLMProvider | null = null;

export function getDefaultLLMProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const config = loadConfig();

  switch (config.llmProvider) {
    case 'claude':
    default:
      cachedProvider = new ClaudeProvider();
      return cachedProvider;
  }
}
