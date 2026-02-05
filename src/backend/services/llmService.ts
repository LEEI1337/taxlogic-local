/**
 * TaxLogic.local - LLM Service
 *
 * Unified interface for multiple LLM providers:
 * - Ollama (local, primary)
 * - LM Studio (local, secondary)
 * - Claude API (cloud, BYOK)
 * - OpenAI/ChatGPT (cloud, BYOK)
 * - Google Gemini (cloud, BYOK)
 * - OpenAI-compatible endpoints (for other providers)
 */

import Anthropic from '@anthropic-ai/sdk';

export type LLMProvider = 'ollama' | 'lmStudio' | 'claude' | 'openai' | 'gemini' | 'openaiCompatible';

export interface LLMConfig {
  provider: LLMProvider;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  lmStudioUrl?: string;
  lmStudioModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiBaseUrl?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  openaiCompatibleUrl?: string;
  openaiCompatibleApiKey?: string;
  openaiCompatibleModel?: string;
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
  anthropicModel: 'claude-3-5-sonnet-20241022',
  openaiModel: 'gpt-4o',
  openaiBaseUrl: 'https://api.openai.com/v1',
  geminiModel: 'gemini-1.5-flash',
  openaiCompatibleModel: 'local-model'
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
      case 'openai':
        this.config.openaiModel = model;
        break;
      case 'gemini':
        this.config.geminiModel = model;
        break;
      case 'openaiCompatible':
        this.config.openaiCompatibleModel = model;
        break;
    }
  }

  /**
   * Check connection status for all providers
   */
  async checkStatus(): Promise<{
    ollama: boolean;
    lmStudio: boolean;
    claude: boolean;
    openai: boolean;
    gemini: boolean;
    openaiCompatible: boolean;
  }> {
    const [ollama, lmStudio, claude, openai, gemini, openaiCompatible] = await Promise.all([
      this.checkOllamaStatus(),
      this.checkLMStudioStatus(),
      this.checkClaudeStatus(),
      this.checkOpenAIStatus(),
      this.checkGeminiStatus(),
      this.checkOpenAICompatibleStatus()
    ]);

    return { ollama, lmStudio, claude, openai, gemini, openaiCompatible };
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
      case 'openai':
        return this.getOpenAIModels();
      case 'gemini':
        return this.getGeminiModels();
      case 'openaiCompatible':
        return this.getOpenAICompatibleModels();
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
    if (this.config.provider !== 'openai' && this.config.openaiApiKey) {
      providers.push('openai');
    }
    if (this.config.provider !== 'gemini' && this.config.geminiApiKey) {
      providers.push('gemini');
    }
    if (this.config.provider !== 'openaiCompatible' && this.config.openaiCompatibleUrl) {
      providers.push('openaiCompatible');
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
          case 'openai':
            return await this.queryOpenAI(prompt, conversationHistory, systemPrompt);
          case 'gemini':
            return await this.queryGemini(prompt, conversationHistory, systemPrompt);
          case 'openaiCompatible':
            return await this.queryOpenAICompatible(prompt, conversationHistory, systemPrompt);
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

  // ========================================
  // OpenAI / ChatGPT
  // ========================================

  private async checkOpenAIStatus(): Promise<boolean> {
    return !!this.config.openaiApiKey;
  }

  private async getOpenAIModels(): Promise<string[]> {
    // Common OpenAI models
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo'
    ];
  }

  private async queryOpenAI(
    prompt: string,
    conversationHistory: Message[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    if (!this.config.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...conversationHistory,
      { role: 'user', content: prompt }
    ];

    const baseUrl = this.config.openaiBaseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: this.config.openaiModel || 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      provider: 'openai',
      model: this.config.openaiModel || 'unknown',
      tokensUsed: data.usage?.total_tokens
    };
  }

  // ========================================
  // Google Gemini
  // ========================================

  private async checkGeminiStatus(): Promise<boolean> {
    return !!this.config.geminiApiKey;
  }

  private async getGeminiModels(): Promise<string[]> {
    // Common Gemini models
    return [
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-1.5-pro',
      'gemini-2.0-flash-exp',
      'gemini-1.0-pro'
    ];
  }

  private async queryGemini(
    prompt: string,
    conversationHistory: Message[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    if (!this.config.geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    // Build the contents array for Gemini format
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Add conversation history
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    // Add current prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const model = this.config.geminiModel || 'gemini-1.5-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemPrompt ? {
            parts: [{ text: systemPrompt }]
          } : undefined,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000
          }
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      provider: 'gemini',
      model: model,
      tokensUsed: data.usageMetadata?.totalTokenCount
    };
  }

  // ========================================
  // OpenAI-Compatible Endpoints
  // ========================================

  private async checkOpenAICompatibleStatus(): Promise<boolean> {
    if (!this.config.openaiCompatibleUrl) {
      return false;
    }
    try {
      const response = await fetch(`${this.config.openaiCompatibleUrl}/v1/models`, {
        method: 'GET',
        headers: this.config.openaiCompatibleApiKey
          ? { 'Authorization': `Bearer ${this.config.openaiCompatibleApiKey}` }
          : {},
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async getOpenAICompatibleModels(): Promise<string[]> {
    if (!this.config.openaiCompatibleUrl) {
      return [];
    }
    try {
      const response = await fetch(`${this.config.openaiCompatibleUrl}/v1/models`, {
        headers: this.config.openaiCompatibleApiKey
          ? { 'Authorization': `Bearer ${this.config.openaiCompatibleApiKey}` }
          : {}
      });
      const data = await response.json();
      return data.data?.map((m: { id: string }) => m.id) || [];
    } catch {
      return [];
    }
  }

  private async queryOpenAICompatible(
    prompt: string,
    conversationHistory: Message[],
    systemPrompt?: string
  ): Promise<LLMResponse> {
    if (!this.config.openaiCompatibleUrl) {
      throw new Error('OpenAI-compatible endpoint URL not configured');
    }

    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...conversationHistory,
      { role: 'user', content: prompt }
    ];

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.config.openaiCompatibleApiKey) {
      headers['Authorization'] = `Bearer ${this.config.openaiCompatibleApiKey}`;
    }

    const response = await fetch(`${this.config.openaiCompatibleUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.openaiCompatibleModel || 'local-model',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible endpoint request failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.choices?.[0]?.message?.content || '',
      provider: 'openaiCompatible',
      model: this.config.openaiCompatibleModel || 'unknown',
      tokensUsed: data.usage?.total_tokens
    };
  }
}

// Singleton instance
export const llmService = new LLMService();
export default LLMService;
