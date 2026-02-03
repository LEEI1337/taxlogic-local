/**
 * TaxLogic.local - LLM Service
 *
 * Unified interface for multiple LLM providers:
 * - Ollama (local, primary)
 * - LM Studio (local, secondary)
 * - Claude API (cloud, BYOK fallback)
 */

import Anthropic from '@anthropic-ai/sdk';

export type LLMProvider = 'ollama' | 'lmStudio' | 'claude';

export interface LLMConfig {
  provider: LLMProvider;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  lmStudioUrl?: string;
  lmStudioModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  tokensUsed?: number;
}

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'ollama',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'mistral:latest',
  lmStudioUrl: 'http://localhost:1234',
  lmStudioModel: 'local-model',
  anthropicModel: 'claude-3-5-sonnet-20241022'
};

class LLMService {
  private config: LLMConfig;
  private anthropicClient: Anthropic | null = null;

  constructor(config: Partial<LLMConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize Anthropic client if API key is provided
    if (this.config.anthropicApiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.anthropicApiKey
      });
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize Anthropic client if API key changed
    if (config.anthropicApiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: config.anthropicApiKey
      });
    }
  }

  /**
   * Set the active LLM provider
   */
  setProvider(provider: LLMProvider): void {
    this.config.provider = provider;
  }

  /**
   * Set the active model for the current provider
   */
  setModel(model: string): void {
    switch (this.config.provider) {
      case 'ollama':
        this.config.ollamaModel = model;
        break;
      case 'lmStudio':
        this.config.lmStudioModel = model;
        break;
      case 'claude':
        this.config.anthropicModel = model;
        break;
    }
  }

  /**
   * Check connection status for all providers
   */
  async checkStatus(): Promise<{ ollama: boolean; lmStudio: boolean; claude: boolean }> {
    const [ollama, lmStudio, claude] = await Promise.all([
      this.checkOllamaStatus(),
      this.checkLMStudioStatus(),
      this.checkClaudeStatus()
    ]);

    return { ollama, lmStudio, claude };
  }

  /**
   * Get available models from the current provider
   */
  async getAvailableModels(): Promise<string[]> {
    switch (this.config.provider) {
      case 'ollama':
        return this.getOllamaModels();
      case 'lmStudio':
        return this.getLMStudioModels();
      case 'claude':
        return this.getClaudeModels();
    }
  }

  /**
   * Send a query to the LLM
   */
  async query(
    prompt: string,
    conversationHistory: Message[] = [],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    // Try primary provider first, then fallback
    const providers: LLMProvider[] = [this.config.provider];

    // Add fallbacks
    if (this.config.provider !== 'ollama') providers.push('ollama');
    if (this.config.provider !== 'lmStudio') providers.push('lmStudio');
    if (this.config.provider !== 'claude' && this.anthropicClient) {
      providers.push('claude');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        switch (provider) {
          case 'ollama':
            return await this.queryOllama(prompt, conversationHistory, systemPrompt);
          case 'lmStudio':
            return await this.queryLMStudio(prompt, conversationHistory, systemPrompt);
          case 'claude':
            return await this.queryClaude(prompt, conversationHistory, systemPrompt);
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`LLM provider ${provider} failed:`, error);
        continue;
      }
    }

    throw lastError || new Error('All LLM providers failed');
  }

  // ========================================
  // Ollama
  // ========================================

  private async checkOllamaStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async getOllamaModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`);
      const data = await response.json();
      return data.models?.map((m: { name: string }) => m.name) || [];
    } catch {
      return [];
    }
  }

  private async queryOllama(
    prompt: string,
    conversationHistory: Message[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...conversationHistory,
      { role: 'user', content: prompt }
    ];

    const response = await fetch(`${this.config.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.ollamaModel,
        messages,
        stream: false
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
      provider: 'ollama',
      model: this.config.ollamaModel || 'unknown'
    };
  }

  // ========================================
  // LM Studio
  // ========================================

  private async checkLMStudioStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.lmStudioUrl}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async getLMStudioModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.lmStudioUrl}/v1/models`);
      const data = await response.json();
      return data.data?.map((m: { id: string }) => m.id) || [];
    } catch {
      return [];
    }
  }

  private async queryLMStudio(
    prompt: string,
    conversationHistory: Message[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...conversationHistory,
      { role: 'user', content: prompt }
    ];

    const response = await fetch(`${this.config.lmStudioUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.lmStudioModel,
        messages,
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      throw new Error(`LM Studio request failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      provider: 'lmStudio',
      model: this.config.lmStudioModel || 'unknown',
      tokensUsed: data.usage?.total_tokens
    };
  }

  // ========================================
  // Claude (Anthropic)
  // ========================================

  private async checkClaudeStatus(): Promise<boolean> {
    return !!this.anthropicClient;
  }

  private async getClaudeModels(): Promise<string[]> {
    // Claude models are fixed
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307'
    ];
  }

  private async queryClaude(
    prompt: string,
    conversationHistory: Message[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic API key not configured');
    }

    // Convert messages to Anthropic format
    const messages = [
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user' as const, content: prompt }
    ];

    const response = await this.anthropicClient.messages.create({
      model: this.config.anthropicModel || 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: systemPrompt || 'You are a helpful Austrian tax advisor.',
      messages
    });

    const textContent = response.content.find((c) => c.type === 'text');

    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      provider: 'claude',
      model: this.config.anthropicModel || 'unknown',
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens
    };
  }
}

// Singleton instance
export const llmService = new LLMService();
export default LLMService;
