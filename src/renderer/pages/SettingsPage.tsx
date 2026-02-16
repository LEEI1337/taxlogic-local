/**
 * TaxLogic.local - Settings Page
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppStore, AppSettings } from '../stores/appStore';

// API key names managed via IPC (safeStorage)
const API_KEY_NAMES = ['anthropicApiKey', 'openaiApiKey', 'geminiApiKey', 'openaiCompatibleApiKey'] as const;
type ApiKeyName = typeof API_KEY_NAMES[number];

function SettingsPage(): React.ReactElement {
  const navigate = useNavigate();
  const {
    settings,
    updateSettings,
    llmStatus,
    checkLLMStatus,
    isCheckingLLM,
    currentTaxYear,
    setCurrentTaxYear,
    userProfile,
    setUserProfile,
    setOnboarded
  } = useAppStore();

  // API keys are stored securely via Electron safeStorage, not in Zustand/localStorage
  const [apiKeys, setApiKeys] = useState<Record<ApiKeyName, string>>({
    anthropicApiKey: '',
    openaiApiKey: '',
    geminiApiKey: '',
    openaiCompatibleApiKey: ''
  });
  const [apiKeyStorageMode, setApiKeyStorageMode] = useState<'encrypted' | 'unavailable'>('encrypted');
  const [supportedYears, setSupportedYears] = useState<number[]>([]);

  // Load API keys on mount
  useEffect(() => {
    const loadKeys = async () => {
      if (!window.electronAPI) return;
      try {
        const allKeys = await window.electronAPI.invoke('apiKeys:getAll');
        if (allKeys && typeof allKeys === 'object') {
          const keyData = allKeys as Record<string, string>;
          if (keyData._storageMode === 'unavailable') {
            setApiKeyStorageMode('unavailable');
          } else {
            setApiKeyStorageMode('encrypted');
          }
          setApiKeys((prev) => ({
            ...prev,
            anthropicApiKey: keyData.anthropicApiKey || prev.anthropicApiKey,
            openaiApiKey: keyData.openaiApiKey || prev.openaiApiKey,
            geminiApiKey: keyData.geminiApiKey || prev.geminiApiKey,
            openaiCompatibleApiKey: keyData.openaiCompatibleApiKey || prev.openaiCompatibleApiKey
          }));
        }
      } catch (err) {
        console.error('Failed to load API keys:', err);
      }
    };
    loadKeys();
  }, []);

  useEffect(() => {
    const loadTaxYears = async () => {
      if (!window.electronAPI?.taxRules) {
        return;
      }

      try {
        const years = await window.electronAPI.taxRules.getSupportedYears();
        setSupportedYears(years.sort((a, b) => b - a));
      } catch (error) {
        console.error('Failed to load supported tax years:', error);
      }
    };

    loadTaxYears().catch((error) => {
      console.error('Tax year loading error:', error);
    });
  }, []);

  const updateApiKey = useCallback(async (keyName: ApiKeyName, value: string) => {
    setApiKeys((prev) => ({ ...prev, [keyName]: value }));
    if (window.electronAPI) {
      try {
        await window.electronAPI.invoke('apiKeys:set', keyName, value);
      } catch (err) {
        console.error(`Failed to save ${keyName}:`, err);
      }
    }
  }, []);

  const handleTaxYearChange = useCallback(async (yearValue: string) => {
    const nextYear = Number(yearValue);
    if (Number.isNaN(nextYear)) {
      return;
    }

    setCurrentTaxYear(nextYear);

    if (window.electronAPI) {
      try {
        await window.electronAPI.invoke('settings:set', 'currentTaxYear', nextYear);
      } catch (error) {
        console.error('Failed to persist tax year:', error);
      }
    }
  }, [setCurrentTaxYear]);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-white mb-6">Einstellungen</h2>

      {/* LLM Configuration */}
      <section className="card p-6 mb-6">
        <h3 className="font-medium text-white mb-4">KI-Konfiguration</h3>

        {apiKeyStorageMode === 'unavailable' && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-300">
              Sichere API-Key-Speicherung ist auf diesem System nicht verfuegbar. Cloud-Provider bleiben deaktiviert.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Preferred LLM */}
          <div>
            <label className="label">Bevorzugter LLM-Dienst</label>
            <select
              value={settings.preferredLLM}
              onChange={(e) => updateSettings({ preferredLLM: e.target.value as AppSettings['preferredLLM'] })}
              className="input"
            >
              <optgroup label="Lokal">
                <option value="ollama">Ollama (Lokal)</option>
                <option value="lmStudio">LM Studio (Lokal)</option>
              </optgroup>
              <optgroup label="Cloud (BYOK)">
                <option value="claude">Claude API (Anthropic)</option>
                <option value="openai">OpenAI / ChatGPT</option>
                <option value="gemini">Google Gemini</option>
              </optgroup>
              <optgroup label="Andere">
                <option value="openaiCompatible">OpenAI-kompatibel (Custom)</option>
              </optgroup>
            </select>
          </div>

          {/* Ollama Configuration */}
          {settings.preferredLLM === 'ollama' && (
            <>
              <div>
                <label className="label">Ollama Server URL</label>
                <input
                  type="text"
                  value={settings.ollamaUrl}
                  onChange={(e) => updateSettings({ ollamaUrl: e.target.value })}
                  className="input"
                  placeholder="http://localhost:11434"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Lokal oder im Netzwerk (z.B. http://10.40.10.90:11434)
                </p>
              </div>
              <div>
                <label className="label">Ollama Modell</label>
                <input
                  type="text"
                  value={settings.ollamaModel}
                  onChange={(e) => updateSettings({ ollamaModel: e.target.value })}
                  className="input"
                  placeholder="z.B. llama3.1:8b"
                />
              </div>
            </>
          )}

          {/* Claude API Key */}
          {settings.preferredLLM === 'claude' && (
            <div>
              <label className="label">Anthropic API Key</label>
              <input
                type="password"
                value={apiKeys.anthropicApiKey}
                onChange={(e) => updateApiKey('anthropicApiKey', e.target.value)}
                className="input"
                placeholder="sk-ant-..."
              />
              <p className="text-xs text-neutral-500 mt-1">
                Ihr API-Schlüssel wird verschlüsselt auf Ihrem Computer gespeichert.
              </p>
            </div>
          )}

          {/* OpenAI Configuration */}
          {settings.preferredLLM === 'openai' && (
            <>
              <div>
                <label className="label">OpenAI API Key</label>
                <input
                  type="password"
                  value={apiKeys.openaiApiKey}
                  onChange={(e) => updateApiKey('openaiApiKey', e.target.value)}
                  className="input"
                  placeholder="sk-..."
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Ihr API-Schlüssel wird verschlüsselt auf Ihrem Computer gespeichert.
                </p>
              </div>
              <div>
                <label className="label">OpenAI Modell</label>
                <select
                  value={settings.openaiModel || 'gpt-4o'}
                  onChange={(e) => updateSettings({ openaiModel: e.target.value })}
                  className="input"
                >
                  <option value="gpt-4o">GPT-4o (Empfohlen)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
            </>
          )}

          {/* Gemini Configuration */}
          {settings.preferredLLM === 'gemini' && (
            <>
              <div>
                <label className="label">Google Gemini API Key</label>
                <input
                  type="password"
                  value={apiKeys.geminiApiKey}
                  onChange={(e) => updateApiKey('geminiApiKey', e.target.value)}
                  className="input"
                  placeholder="AIza..."
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Erhalten Sie einen kostenlosen API-Schlüssel bei{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-400 hover:underline"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
              <div>
                <label className="label">Gemini Modell</label>
                <select
                  value={settings.geminiModel || 'gemini-1.5-flash'}
                  onChange={(e) => updateSettings({ geminiModel: e.target.value })}
                  className="input"
                >
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Kostenlos)</option>
                  <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash-8B</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                  <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                </select>
              </div>
            </>
          )}

          {/* OpenAI-Compatible Configuration */}
          {settings.preferredLLM === 'openaiCompatible' && (
            <>
              <div>
                <label className="label">API Endpoint URL</label>
                <input
                  type="text"
                  value={settings.openaiCompatibleUrl || ''}
                  onChange={(e) => updateSettings({ openaiCompatibleUrl: e.target.value })}
                  className="input"
                  placeholder="http://localhost:8080"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Kompatibel mit vLLM, text-generation-webui, LocalAI, etc.
                </p>
              </div>
              <div>
                <label className="label">API Key (optional)</label>
                <input
                  type="password"
                  value={apiKeys.openaiCompatibleApiKey}
                  onChange={(e) => updateApiKey('openaiCompatibleApiKey', e.target.value)}
                  className="input"
                  placeholder="Leer lassen wenn nicht benötigt"
                />
              </div>
              <div>
                <label className="label">Modellname</label>
                <input
                  type="text"
                  value={settings.openaiCompatibleModel || ''}
                  onChange={(e) => updateSettings({ openaiCompatibleModel: e.target.value })}
                  className="input"
                  placeholder="z.B. mistral-7b"
                />
              </div>
            </>
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
                {isCheckingLLM ? 'Prüfe...' : 'Aktualisieren'}
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
              <div className="flex items-center gap-2">
                <div className={`status-dot ${llmStatus.openai ? 'status-dot-online' : 'status-dot-offline'}`} />
                <span className={llmStatus.openai ? 'text-green-400' : 'text-neutral-500'}>OpenAI</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`status-dot ${llmStatus.gemini ? 'status-dot-online' : 'status-dot-offline'}`} />
                <span className={llmStatus.gemini ? 'text-green-400' : 'text-neutral-500'}>Gemini</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`status-dot ${llmStatus.openaiCompatible ? 'status-dot-online' : 'status-dot-offline'}`} />
                <span className={llmStatus.openaiCompatible ? 'text-green-400' : 'text-neutral-500'}>Custom</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Profile */}
      <section className="card p-6 mb-6">
        <h3 className="font-medium text-white mb-4">Profil</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Beruf / Tatigkeit</label>
            <input
              type="text"
              value={userProfile.profession || ''}
              onChange={(e) => setUserProfile({ profession: e.target.value })}
              className="input"
              placeholder="z.B. Software-Entwickler, Lehrer, Arzt..."
            />
          </div>
          <div>
            <label className="label">Beschaftigungsstatus</label>
            <select
              value={userProfile.employmentStatus || 'employee'}
              onChange={(e) => setUserProfile({ employmentStatus: e.target.value as 'employee' | 'freelancer' | 'business_owner' | 'retired' })}
              className="input"
            >
              <option value="employee">Angestellt</option>
              <option value="freelancer">Freiberuflich</option>
              <option value="business_owner">Unternehmer</option>
              <option value="retired">Pensionist</option>
            </select>
          </div>
          <div>
            <label className="label">Aktives Steuerjahr</label>
            <select
              value={String(currentTaxYear)}
              onChange={(e) => {
                handleTaxYearChange(e.target.value).catch((error) => {
                  console.error('Tax year change failed:', error);
                });
              }}
              className="input"
            >
              {(supportedYears.length > 0 ? supportedYears : [currentTaxYear]).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              setOnboarded(false);
              navigate('/onboarding');
            }}
            className="btn-ghost text-sm text-neutral-400 hover:text-white"
          >
            Einrichtungsassistent erneut starten
          </button>
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
              onChange={(e) => updateSettings({ theme: e.target.value as AppSettings['theme'] })}
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
              onChange={(e) => updateSettings({ language: e.target.value as AppSettings['language'] })}
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
