/**
 * TaxLogic.local - Onboarding Page
 *
 * First-run setup wizard for new users.
 * Guides through: Welcome → KI-Setup → Profil → Fertig
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppStore, UserProfile } from '../stores/appStore';

type OnboardingStep = 'welcome' | 'llm-setup' | 'profile' | 'complete';

function OnboardingPage(): React.ReactElement {
  const navigate = useNavigate();
  const {
    setOnboarded,
    llmStatus,
    checkLLMStatus,
    isCheckingLLM,
    setUserProfile,
    settings,
    updateSettings
  } = useAppStore();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [profession, setProfession] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<string>('employee');
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel || 'llama3.1:8b');
  const [claudeApiKey, setClaudeApiKey] = useState('');
  const [showClaudeInput, setShowClaudeInput] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [urlSaved, setUrlSaved] = useState(false);

  useEffect(() => {
    checkLLMStatus();
  }, [checkLLMStatus]);

  // Load available models when Ollama connects
  useEffect(() => {
    if (llmStatus.ollama && window.electronAPI) {
      window.electronAPI.invoke('llm:getAvailableModels')
        .then((models) => setAvailableModels(models as string[]))
        .catch(() => setAvailableModels([]));
    }
  }, [llmStatus.ollama]);

  const handleSaveOllamaUrl = useCallback(() => {
    updateSettings({ ollamaUrl });
    if (window.electronAPI) {
      window.electronAPI.invoke('llm:setConfig', {
        ollamaBaseUrl: ollamaUrl
      }).then(() => {
        setUrlSaved(true);
        setTimeout(() => setUrlSaved(false), 2000);
        return checkLLMStatus();
      }).catch((err: unknown) => console.error(err));
    }
  }, [ollamaUrl, updateSettings, checkLLMStatus]);

  const handleSaveModel = useCallback((model: string) => {
    setOllamaModel(model);
    updateSettings({ ollamaModel: model });
    if (window.electronAPI) {
      window.electronAPI.invoke('llm:setConfig', { ollamaModel: model })
        .catch((err: unknown) => console.error(err));
    }
  }, [updateSettings]);

  const handleSaveClaudeKey = useCallback(async () => {
    if (window.electronAPI && claudeApiKey.trim()) {
      try {
        await window.electronAPI.invoke('apiKeys:set', 'anthropicApiKey', claudeApiKey.trim());
        setClaudeApiKey('');
        setShowClaudeInput(false);
        checkLLMStatus();
      } catch (err) {
        console.error('Failed to save Claude API key:', err);
      }
    }
  }, [claudeApiKey, checkLLMStatus]);

  const handleContinue = (): void => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('llm-setup');
        break;
      case 'llm-setup':
        setCurrentStep('profile');
        break;
      case 'profile':
        setUserProfile({
          profession,
          employmentStatus: employmentStatus as UserProfile['employmentStatus']
        });
        setCurrentStep('complete');
        break;
      case 'complete':
        setOnboarded(true);
        navigate('/interview');
        break;
    }
  };

  const handleBack = (): void => {
    switch (currentStep) {
      case 'llm-setup':
        setCurrentStep('welcome');
        break;
      case 'profile':
        setCurrentStep('llm-setup');
        break;
      case 'complete':
        setCurrentStep('profile');
        break;
    }
  };

  const hasActiveLLM = llmStatus.ollama || llmStatus.lmStudio || llmStatus.claude;

  const stepLabels: Record<OnboardingStep, string> = {
    'welcome': 'Willkommen',
    'llm-setup': 'KI-Setup',
    'profile': 'Profil',
    'complete': 'Fertig'
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">TaxLogic.local</h1>
          <p className="text-neutral-400 mt-2">Ihr personlicher Steuerberater - 100% lokal & privat</p>
        </div>

        {/* Step indicator with labels */}
        <div className="flex justify-center gap-1 mb-6">
          {(['welcome', 'llm-setup', 'profile', 'complete'] as OnboardingStep[]).map((step, i) => (
            <div key={step} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors ${
                currentStep === step
                  ? 'bg-accent-500/20 text-accent-400 font-medium'
                  : (['welcome', 'llm-setup', 'profile', 'complete'].indexOf(currentStep) > i
                    ? 'text-green-400'
                    : 'text-neutral-600')
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  currentStep === step ? 'bg-accent-500'
                  : (['welcome', 'llm-setup', 'profile', 'complete'].indexOf(currentStep) > i ? 'bg-green-500' : 'bg-neutral-700')
                }`} />
                {stepLabels[step]}
              </div>
              {i < 3 && <div className="w-4 h-px bg-neutral-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="card p-8">
          {/* ========== WELCOME ========== */}
          {currentStep === 'welcome' && (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-4">Willkommen!</h2>
              <p className="text-neutral-400 mb-6 leading-relaxed">
                TaxLogic hilft Ihnen, Ihre osterreichische Steuererklarung schnell und einfach zu erstellen.
                Alle Daten bleiben auf Ihrem Computer - wir senden nichts in die Cloud.
              </p>
              <div className="flex flex-col gap-3 text-left bg-neutral-800/50 rounded-lg p-4 mb-6">
                {[
                  'Intelligentes Steuer-Interview mit KI',
                  'Automatische Belegerfassung (OCR)',
                  'L1, L1ab, L1k Formular-Export fur FinanzOnline',
                  'Schritt-fur-Schritt Anleitung',
                  'Alle Daten 100% lokal - kein Cloud-Upload'
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-neutral-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-left">
                <p className="text-blue-400 text-sm">
                  <strong>So funktioniert es:</strong> TaxLogic nutzt eine lokale KI (Ollama), um Sie durch
                  ein intelligentes Interview zu fuhren. Die KI analysiert Ihre Dokumente und berechnet
                  automatisch alle moglichen Absetzungen nach osterreichischem Steuerrecht (EStG 2024).
                </p>
              </div>
            </div>
          )}

          {/* ========== LLM SETUP ========== */}
          {currentStep === 'llm-setup' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">KI-Verbindung einrichten</h2>
              <p className="text-neutral-400 mb-6 text-sm">
                TaxLogic braucht eine KI fur das intelligente Steuer-Interview.
                Wahlen Sie eine der folgenden Optionen:
              </p>

              {/* Ollama Section */}
              <div className="mb-4">
                <div className={`p-4 rounded-lg border ${llmStatus.ollama ? 'border-green-800 bg-green-900/20' : 'border-neutral-700 bg-neutral-800/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${llmStatus.ollama ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <span className="font-medium text-white">Ollama</span>
                        <span className="text-xs text-neutral-500 ml-2">(Empfohlen - lokal & kostenlos)</span>
                      </div>
                    </div>
                    <span className={`text-sm ${llmStatus.ollama ? 'text-green-400' : 'text-red-400'}`}>
                      {llmStatus.ollama ? 'Verbunden' : 'Nicht verbunden'}
                    </span>
                  </div>

                  {/* Ollama URL input */}
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="input text-sm flex-1"
                      placeholder="http://localhost:11434"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                    />
                    <button onClick={handleSaveOllamaUrl} className="btn-secondary text-sm px-3">
                      {urlSaved ? 'Gespeichert!' : 'Testen'}
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 mb-3">
                    Ollama-Adresse (lokal: http://localhost:11434, Netzwerk: http://IP:11434)
                  </p>

                  {/* Model selection when connected */}
                  {llmStatus.ollama && availableModels.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-700">
                      <label className="text-xs text-neutral-400 block mb-1.5">Modell wahlen:</label>
                      <select
                        className="input text-sm"
                        value={ollamaModel}
                        onChange={(e) => handleSaveModel(e.target.value)}
                      >
                        {availableModels.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Install hint */}
                  {!llmStatus.ollama && (
                    <div className="mt-3 pt-3 border-t border-neutral-700">
                      <p className="text-xs text-neutral-400 mb-2">
                        Ollama ist nicht installiert oder nicht erreichbar?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (window.electronAPI) {
                              window.electronAPI.invoke('fs:openPath', 'https://ollama.com/download');
                            }
                          }}
                          className="btn-ghost text-xs px-3 py-1.5"
                        >
                          Ollama herunterladen (ollama.com)
                        </button>
                      </div>
                      <p className="text-xs text-neutral-500 mt-2">
                        Nach der Installation: Ollama starten, dann hier &quot;Testen&quot; klicken.
                        Empfohlenes Modell: <code className="text-accent-400">ollama pull llama3.1:8b</code>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* LM Studio */}
              <div className="mb-4">
                <div className={`p-4 rounded-lg border ${llmStatus.lmStudio ? 'border-green-800 bg-green-900/20' : 'border-neutral-700 bg-neutral-800/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${llmStatus.lmStudio ? 'bg-green-500' : 'bg-neutral-600'}`} />
                      <div>
                        <span className="font-medium text-white">LM Studio</span>
                        <span className="text-xs text-neutral-500 ml-2">(Alternative - lokal)</span>
                      </div>
                    </div>
                    <span className={`text-sm ${llmStatus.lmStudio ? 'text-green-400' : 'text-neutral-500'}`}>
                      {llmStatus.lmStudio ? 'Verbunden' : 'Nicht aktiv'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Claude API */}
              <div className="mb-4">
                <div className={`p-4 rounded-lg border ${llmStatus.claude ? 'border-green-800 bg-green-900/20' : 'border-neutral-700 bg-neutral-800/50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${llmStatus.claude ? 'bg-green-500' : 'bg-neutral-600'}`} />
                      <div>
                        <span className="font-medium text-white">Claude API</span>
                        <span className="text-xs text-neutral-500 ml-2">(Cloud - kostenpflichtig)</span>
                      </div>
                    </div>
                    {!showClaudeInput && (
                      <button onClick={() => setShowClaudeInput(true)} className="text-xs text-accent-400 hover:text-accent-300">
                        {llmStatus.claude ? 'Key andern' : 'API Key eingeben'}
                      </button>
                    )}
                  </div>

                  {showClaudeInput && (
                    <div className="mt-3">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          className="input text-sm flex-1"
                          placeholder="sk-ant-api03-..."
                          value={claudeApiKey}
                          onChange={(e) => setClaudeApiKey(e.target.value)}
                        />
                        <button onClick={handleSaveClaudeKey} className="btn-secondary text-sm px-3">
                          Speichern
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Claude API Warning */}
                  <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 mt-3">
                    <p className="text-yellow-400 text-xs leading-relaxed">
                      <strong>Achtung:</strong> Bei Verwendung der Claude API werden Ihre Steuerdaten
                      an Anthropic-Server gesendet. Der API Key wird lokal verschlusselt gespeichert,
                      aber Ihre Steuerdaten verlassen Ihren Computer. Fur maximale Privatsphare
                      empfehlen wir Ollama (100% lokal).
                    </p>
                  </div>
                </div>
              </div>

              {/* Status check button */}
              <button
                onClick={() => checkLLMStatus()}
                className="btn-secondary w-full"
                disabled={isCheckingLLM}
              >
                {isCheckingLLM ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="spinner w-4 h-4" />
                    Prufe Verbindungen...
                  </span>
                ) : (
                  'Alle Verbindungen prufen'
                )}
              </button>

              {!hasActiveLLM && (
                <p className="text-xs text-neutral-500 text-center mt-3">
                  Sie konnen auch ohne KI fortfahren - die intelligente Beratung ist dann eingeschrankt.
                </p>
              )}
            </div>
          )}

          {/* ========== PROFILE ========== */}
          {currentStep === 'profile' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Ihr Profil</h2>
              <p className="text-neutral-400 mb-6 text-sm">
                Diese Angaben helfen der KI, das Interview auf Ihre Situation anzupassen.
                Sie konnen diese Einstellungen spater jederzeit in den Einstellungen andern.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="label">Beruf / Tatigkeit</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="z.B. Software-Entwickler, Lehrer, Arzt..."
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Ihr Beruf bestimmt, welche Absetzungen relevant sind (z.B. Fortbildungen, Arbeitsmittel).
                  </p>
                </div>

                <div>
                  <label className="label">Beschaftigungsstatus</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'employee', label: 'Angestellt', desc: 'Lohnsteuerpflichtig (L1)' },
                      { value: 'freelancer', label: 'Freiberuflich', desc: 'Einnahmen-Ausgaben (L1ab)' },
                      { value: 'business_owner', label: 'Unternehmer', desc: 'Gewerbebetrieb (L1ab)' },
                      { value: 'retired', label: 'Pensionist', desc: 'Pensionsbezuge (L1)' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setEmploymentStatus(option.value)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          employmentStatus === option.value
                            ? 'border-accent-500 bg-accent-500/20 text-white'
                            : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600'
                        }`}
                      >
                        <div className="font-medium text-sm">{option.label}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-neutral-800/50 rounded-lg p-3">
                  <p className="text-xs text-neutral-400">
                    <strong>Steuerjahr {new Date().getFullYear() - 1}:</strong> TaxLogic erstellt Ihre Erklarung
                    fur das vergangene Jahr. Die Berechnung basiert auf dem aktuellen EStG 2024 mit allen
                    Steuerstufen, Freibetragen und Absetzbetragsregelungen.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========== COMPLETE ========== */}
          {currentStep === 'complete' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-900/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-4">Alles bereit!</h2>

              {/* Summary */}
              <div className="text-left bg-neutral-800/50 rounded-lg p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">KI:</span>
                  <span className="text-white">
                    {llmStatus.ollama ? `Ollama (${ollamaModel})` :
                     llmStatus.lmStudio ? 'LM Studio' :
                     llmStatus.claude ? 'Claude API' : 'Keine KI'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Beruf:</span>
                  <span className="text-white">{profession || '(nicht angegeben)'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Status:</span>
                  <span className="text-white">
                    {employmentStatus === 'employee' ? 'Angestellt' :
                     employmentStatus === 'freelancer' ? 'Freiberuflich' :
                     employmentStatus === 'business_owner' ? 'Unternehmer' : 'Pensionist'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Steuerjahr:</span>
                  <span className="text-white">{new Date().getFullYear() - 1}</span>
                </div>
              </div>

              <p className="text-neutral-400 text-sm mb-4">
                Im nachsten Schritt fuhrt Sie die KI durch ein Interview, um alle relevanten
                Informationen fur Ihre Steuererklarung zu erfassen.
              </p>

              <p className="text-xs text-neutral-500">
                Einstellungen konnen jederzeit uber das Menu &quot;Einstellungen&quot; geandert werden.
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-6">
            {currentStep !== 'welcome' && (
              <button onClick={handleBack} className="btn-ghost flex-1">
                Zuruck
              </button>
            )}
            <button onClick={handleContinue} className="btn-primary flex-1">
              {currentStep === 'complete' ? 'Interview starten' : 'Weiter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingPage;
