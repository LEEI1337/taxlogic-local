/**
 * TaxLogic.local - Onboarding Page
 *
 * First-run setup wizard for new users.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';

type OnboardingStep = 'welcome' | 'llm-check' | 'profile' | 'complete';

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

  useEffect(() => {
    // Check LLM status on mount
    checkLLMStatus();
  }, [checkLLMStatus]);

  const handleContinue = (): void => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('llm-check');
        break;
      case 'llm-check':
        setCurrentStep('profile');
        break;
      case 'profile':
        setUserProfile({
          profession,
          employmentStatus: employmentStatus as any
        });
        setCurrentStep('complete');
        break;
      case 'complete':
        setOnboarded(true);
        navigate('/interview');
        break;
    }
  };

  const hasActiveLLM = llmStatus.ollama || llmStatus.lmStudio || llmStatus.claude;

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
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

        {/* Step content */}
        <div className="card p-8">
          {currentStep === 'welcome' && (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-4">Willkommen!</h2>
              <p className="text-neutral-400 mb-6 leading-relaxed">
                TaxLogic hilft Ihnen, Ihre osterreichische Steuererklarung schnell und einfach zu erstellen.
                Alle Daten bleiben auf Ihrem Computer - wir senden nichts in die Cloud.
              </p>
              <div className="flex flex-col gap-3 text-left bg-neutral-800/50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-neutral-300">Intelligentes Steuer-Interview</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-neutral-300">Automatische Belegerfassung (OCR)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-neutral-300">L1, L1ab, L1k Formular-Export</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-neutral-300">Schritt-fur-Schritt Anleitung</span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'llm-check' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">KI-Verbindung</h2>
              <p className="text-neutral-400 mb-6">
                TaxLogic benotigt einen lokalen KI-Dienst (Ollama oder LM Studio) fur intelligente Steuerberatung.
              </p>

              <div className="space-y-3 mb-6">
                <div className={`flex items-center justify-between p-4 rounded-lg border ${llmStatus.ollama ? 'border-green-800 bg-green-900/20' : 'border-neutral-700 bg-neutral-800/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${llmStatus.ollama ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <span className="font-medium text-white">Ollama</span>
                      <p className="text-xs text-neutral-500">localhost:11434</p>
                    </div>
                  </div>
                  <span className={`text-sm ${llmStatus.ollama ? 'text-green-400' : 'text-red-400'}`}>
                    {llmStatus.ollama ? 'Verbunden' : 'Nicht verfugbar'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-lg border ${llmStatus.lmStudio ? 'border-green-800 bg-green-900/20' : 'border-neutral-700 bg-neutral-800/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${llmStatus.lmStudio ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <span className="font-medium text-white">LM Studio</span>
                      <p className="text-xs text-neutral-500">localhost:1234</p>
                    </div>
                  </div>
                  <span className={`text-sm ${llmStatus.lmStudio ? 'text-green-400' : 'text-red-400'}`}>
                    {llmStatus.lmStudio ? 'Verbunden' : 'Nicht verfugbar'}
                  </span>
                </div>

                <div className={`flex items-center justify-between p-4 rounded-lg border ${llmStatus.claude ? 'border-green-800 bg-green-900/20' : 'border-neutral-700 bg-neutral-800/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${llmStatus.claude ? 'bg-green-500' : 'bg-neutral-600'}`} />
                    <div>
                      <span className="font-medium text-white">Claude API (Optional)</span>
                      <p className="text-xs text-neutral-500">Cloud-Fallback</p>
                    </div>
                  </div>
                  <span className={`text-sm ${llmStatus.claude ? 'text-green-400' : 'text-neutral-500'}`}>
                    {llmStatus.claude ? 'API Key konfiguriert' : 'Nicht konfiguriert'}
                  </span>
                </div>
              </div>

              {!hasActiveLLM && (
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mb-6">
                  <p className="text-yellow-400 text-sm">
                    <strong>Hinweis:</strong> Bitte starten Sie Ollama oder LM Studio, um fortzufahren.
                    Sie konnen die App auch ohne KI verwenden, aber die intelligente Beratung wird eingeschrankt sein.
                  </p>
                </div>
              )}

              <button
                onClick={() => checkLLMStatus()}
                className="btn-secondary w-full mb-4"
                disabled={isCheckingLLM}
              >
                {isCheckingLLM ? (
                  <span className="flex items-center gap-2">
                    <div className="spinner" />
                    Prufe Verbindung...
                  </span>
                ) : (
                  'Erneut prufen'
                )}
              </button>
            </div>
          )}

          {currentStep === 'profile' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Ihr Profil</h2>
              <p className="text-neutral-400 mb-6">
                Ein paar grundlegende Informationen, um das Interview anzupassen.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="label">Beruf / Tatigkeit</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="z.B. Software-Entwickler, Lehrer, Arzt..."
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Beschaftigungsstatus</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'employee', label: 'Angestellt' },
                      { value: 'freelancer', label: 'Freiberuflich' },
                      { value: 'business_owner', label: 'Unternehmer' },
                      { value: 'retired', label: 'Pensionist' }
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
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-900/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-4">Alles bereit!</h2>
              <p className="text-neutral-400 mb-6">
                Ihr Steuerberater ist einsatzbereit. Starten Sie jetzt das Interview, um Ihre Steuererklarung
                fur {new Date().getFullYear() - 1} zu erstellen.
              </p>
            </div>
          )}

          {/* Navigation button */}
          <button onClick={handleContinue} className="btn-primary w-full mt-6">
            {currentStep === 'complete' ? 'Interview starten' : 'Weiter'}
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mt-6">
          {(['welcome', 'llm-check', 'profile', 'complete'] as OnboardingStep[]).map((step, index) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-colors ${
                currentStep === step ? 'bg-accent-500' : 'bg-neutral-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default OnboardingPage;
