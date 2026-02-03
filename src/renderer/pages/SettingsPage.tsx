/**
 * TaxLogic.local - Settings Page
 */

import React from 'react';
import { useAppStore } from '../stores/appStore';

function SettingsPage(): React.ReactElement {
  const {
    settings,
    updateSettings,
    llmStatus,
    checkLLMStatus,
    isCheckingLLM,
    resetSettings
  } = useAppStore();

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-white mb-6">Einstellungen</h2>

      {/* LLM Configuration */}
      <section className="card p-6 mb-6">
        <h3 className="font-medium text-white mb-4">KI-Konfiguration</h3>

        <div className="space-y-4">
          {/* Preferred LLM */}
          <div>
            <label className="label">Bevorzugter LLM-Dienst</label>
            <select
              value={settings.preferredLLM}
              onChange={(e) => updateSettings({ preferredLLM: e.target.value as any })}
              className="input"
            >
              <option value="ollama">Ollama (Lokal)</option>
              <option value="lmStudio">LM Studio (Lokal)</option>
              <option value="claude">Claude API (Cloud)</option>
            </select>
          </div>

          {/* Ollama Model */}
          {settings.preferredLLM === 'ollama' && (
            <div>
              <label className="label">Ollama Modell</label>
              <input
                type="text"
                value={settings.ollamaModel}
                onChange={(e) => updateSettings({ ollamaModel: e.target.value })}
                className="input"
                placeholder="z.B. mistral:latest"
              />
            </div>
          )}

          {/* Claude API Key */}
          {settings.preferredLLM === 'claude' && (
            <div>
              <label className="label">Anthropic API Key</label>
              <input
                type="password"
                value={settings.anthropicApiKey || ''}
                onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
                className="input"
                placeholder="sk-ant-..."
              />
              <p className="text-xs text-neutral-500 mt-1">
                Ihr API-Schlussel wird nur lokal gespeichert.
              </p>
            </div>
          )}

          {/* Connection Status */}
          <div className="bg-neutral-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-400">Verbindungsstatus</span>
              <button
                onClick={() => checkLLMStatus()}
                className="btn-ghost text-xs"
                disabled={isCheckingLLM}
              >
                {isCheckingLLM ? 'Prufe...' : 'Aktualisieren'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div className={`status-dot ${llmStatus.ollama ? 'status-dot-online' : 'status-dot-offline'}`} />
                <span className={llmStatus.ollama ? 'text-green-400' : 'text-neutral-500'}>Ollama</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`status-dot ${llmStatus.lmStudio ? 'status-dot-online' : 'status-dot-offline'}`} />
                <span className={llmStatus.lmStudio ? 'text-green-400' : 'text-neutral-500'}>LM Studio</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`status-dot ${llmStatus.claude ? 'status-dot-online' : 'status-dot-offline'}`} />
                <span className={llmStatus.claude ? 'text-green-400' : 'text-neutral-500'}>Claude</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="card p-6 mb-6">
        <h3 className="font-medium text-white mb-4">Darstellung</h3>

        <div className="space-y-4">
          <div>
            <label className="label">Design</label>
            <select
              value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as any })}
              className="input"
            >
              <option value="dark">Dunkel</option>
              <option value="light">Hell</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <label className="label">Sprache</label>
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value as any })}
              className="input"
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </section>

      {/* Data & Privacy */}
      <section className="card p-6 mb-6">
        <h3 className="font-medium text-white mb-4">Daten & Datenschutz</h3>

        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <div>
              <p className="font-medium text-white">100% Lokal</p>
              <p className="text-sm text-neutral-400 mt-1">
                Alle Ihre Daten werden ausschliesslich auf Ihrem Computer gespeichert.
                Es werden keine Daten an externe Server gesendet (ausser Sie verwenden Claude API).
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button className="btn-secondary w-full justify-between">
            <span>Daten exportieren</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <button className="btn-secondary w-full justify-between text-red-400 hover:text-red-300">
            <span>Alle Daten loschen</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </section>

      {/* About */}
      <section className="card p-6">
        <h3 className="font-medium text-white mb-4">Uber TaxLogic.local</h3>

        <div className="text-sm text-neutral-400 space-y-2">
          <p><strong className="text-neutral-300">Version:</strong> 1.0.0-alpha</p>
          <p><strong className="text-neutral-300">Lizenz:</strong> MIT</p>
          <p><strong className="text-neutral-300">Entwickelt mit:</strong> Electron, React, LangGraph, Ollama</p>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-700 flex items-center gap-4 text-sm">
          <a
            href="https://github.com/taxlogic/taxlogic-local"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-400 hover:underline"
          >
            GitHub
          </a>
          <a
            href="https://github.com/taxlogic/taxlogic-local/wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-400 hover:underline"
          >
            Dokumentation
          </a>
          <a
            href="https://github.com/taxlogic/taxlogic-local/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-400 hover:underline"
          >
            Fehler melden
          </a>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
