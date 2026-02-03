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
    if (llmStatus.ollama) return 'Ollama';
    if (llmStatus.lmStudio) return 'LM Studio';
    if (llmStatus.claude) return 'Claude API';
    return 'Kein LLM verfugbar';
  };

  const getStatusColor = (): string => {
    if (llmStatus.ollama || llmStatus.lmStudio || llmStatus.claude) {
      return 'text-green-400';
    }
    return 'text-red-400';
  };

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
            <div className={`status-dot ${llmStatus.ollama || llmStatus.lmStudio || llmStatus.claude ? 'status-dot-online' : 'status-dot-offline'}`} />
            <span className={getStatusColor()}>{getActiveLLM()}</span>
          </div>
        )}

        {settings.preferredLLM === 'ollama' && llmStatus.ollama && (
          <span className="text-neutral-600">
            Model: {settings.ollamaModel}
          </span>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <span>100% Lokal</span>
        <span className="text-neutral-600">|</span>
        <span>v{version || '1.0.0'}</span>
      </div>
    </footer>
  );
}

export default StatusBar;
