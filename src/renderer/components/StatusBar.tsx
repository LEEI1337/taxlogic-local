/**
 * TaxLogic.local - Status Bar Component
 */

import React, { useEffect, useState } from 'react';

import { useAppStore } from '../stores/appStore';

function StatusBar(): React.ReactElement {
  const { llmStatus, settings, isLoading, loadingMessage } = useAppStore();
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    // Get app version
    if (window.electronAPI) {
      window.electronAPI.getVersion().then(setVersion);
    }
  }, []);

  const getActiveLLM = (): string => {
    if (llmStatus.ollama && settings.preferredLLM === 'ollama') return 'Ollama';
    if (llmStatus.lmStudio && settings.preferredLLM === 'lmStudio') return 'LM Studio';
    if (llmStatus.claude && settings.preferredLLM === 'claude') return 'Claude API';
    if (llmStatus.openai && settings.preferredLLM === 'openai') return 'OpenAI';
    if (llmStatus.gemini && settings.preferredLLM === 'gemini') return 'Gemini';
    if (llmStatus.openaiCompatible && settings.preferredLLM === 'openaiCompatible') return 'Custom';
    // Fallback to any available provider
    if (llmStatus.ollama) return 'Ollama';
    if (llmStatus.lmStudio) return 'LM Studio';
    if (llmStatus.claude) return 'Claude API';
    if (llmStatus.openai) return 'OpenAI';
    if (llmStatus.gemini) return 'Gemini';
    if (llmStatus.openaiCompatible) return 'Custom';
    return 'Kein LLM verfügbar';
  };

  const isAnyLLMAvailable = (): boolean => {
    return llmStatus.ollama || llmStatus.lmStudio || llmStatus.claude ||
           llmStatus.openai || llmStatus.gemini || llmStatus.openaiCompatible;
  };

  const getStatusColor = (): string => {
    if (isAnyLLMAvailable()) {
      return 'text-green-400';
    }
    return 'text-red-400';
  };

  const getActiveModel = (): string | null => {
    if (settings.preferredLLM === 'ollama' && llmStatus.ollama) {
      return settings.ollamaModel;
    }
    if (settings.preferredLLM === 'openai' && llmStatus.openai) {
      return settings.openaiModel || 'gpt-4o';
    }
    if (settings.preferredLLM === 'gemini' && llmStatus.gemini) {
      return settings.geminiModel || 'gemini-1.5-flash';
    }
    if (settings.preferredLLM === 'openaiCompatible' && llmStatus.openaiCompatible) {
      return settings.openaiCompatibleModel || 'local-model';
    }
    return null;
  };

  const isCloudProvider = (): boolean => {
    const cloudProviders = ['claude', 'openai', 'gemini'];
    return cloudProviders.includes(settings.preferredLLM) &&
           (llmStatus.claude || llmStatus.openai || llmStatus.gemini);
  };

  const activeModel = getActiveModel();

  return (
    <footer className="h-7 border-t border-neutral-800 bg-neutral-850 flex items-center justify-between px-4 text-xs text-neutral-500">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="spinner w-3 h-3" />
            <span className="text-accent-400">{loadingMessage || 'Wird geladen...'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className={`status-dot ${isAnyLLMAvailable() ? 'status-dot-online' : 'status-dot-offline'}`} />
            <span className={getStatusColor()}>{getActiveLLM()}</span>
          </div>
        )}

        {activeModel && (
          <span className="text-neutral-600">
            Model: {activeModel}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <span>{isCloudProvider() ? 'Cloud API' : '100% Lokal'}</span>
        <span className="text-neutral-600">|</span>
        <span>v{version || '1.0.0'}</span>
      </div>
    </footer>
  );
}

export default StatusBar;
