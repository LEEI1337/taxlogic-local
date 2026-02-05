/**
 * TaxLogic.local - Export Page
 *
 * Export tax forms and step-by-step guide.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppStore } from '../stores/appStore';

interface ExportForm {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  path?: string;
}

function ExportPage(): React.ReactElement {
  const navigate = useNavigate();
  const { currentTaxYear, addNotification } = useAppStore();

  const [forms, setForms] = useState<ExportForm[]>([
    {
      id: 'L1',
      name: 'Formular L1',
      description: 'Hauptformular der Arbeitnehmerveranlagung',
      status: 'pending'
    },
    {
      id: 'L1ab',
      name: 'Formular L1ab',
      description: 'Beilage zur Arbeitnehmerveranlagung',
      status: 'pending'
    },
    {
      id: 'guide',
      name: 'Schritt-fur-Schritt Anleitung',
      description: 'Personalisierte Anleitung fur Ihre Steuererklarung',
      status: 'pending'
    }
  ]);

  const [isGenerating, setIsGenerating] = useState(false);

  const generateAll = async (): Promise<void> => {
    setIsGenerating(true);

    for (const form of forms) {
      setForms((prev) =>
        prev.map((f) => (f.id === form.id ? { ...f, status: 'generating' } : f))
      );

      // Simulate generation
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setForms((prev) =>
        prev.map((f) =>
          f.id === form.id
            ? { ...f, status: 'ready', path: `./output/${form.id}_${currentTaxYear}.pdf` }
            : f
        )
      );
    }

    setIsGenerating(false);
    addNotification('success', 'Alle Formulare wurden erfolgreich erstellt');
  };

  const downloadForm = async (form: ExportForm): Promise<void> => {
    if (form.path && window.electronAPI) {
      await window.electronAPI.fs.openPath(form.path);
    } else {
      addNotification('info', 'Formular wird heruntergeladen...');
    }
  };

  const openOutputFolder = async (): Promise<void> => {
    if (window.electronAPI) {
      const userDataPath = await window.electronAPI.getUserDataPath();
      await window.electronAPI.fs.openPath(`${userDataPath}/output`);
    }
  };

  const allReady = forms.every((f) => f.status === 'ready');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          Steuererklarung {currentTaxYear} exportieren
        </h2>
        <p className="text-neutral-400">
          Generieren Sie Ihre Steuerformulare und die personalisierte Anleitung zum Ausfullen.
        </p>
      </div>

      {/* Form list */}
      <div className="flex-1 space-y-4">
        {forms.map((form) => (
          <div
            key={form.id}
            className={`card p-6 transition-all ${
              form.status === 'ready' ? 'border-green-800' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    form.status === 'ready'
                      ? 'bg-green-900/50'
                      : form.status === 'generating'
                      ? 'bg-accent-900/50'
                      : 'bg-neutral-800'
                  }`}
                >
                  {form.status === 'generating' ? (
                    <div className="spinner" />
                  ) : form.status === 'ready' ? (
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
                </div>

                <div>
                  <h3 className="font-medium text-white">{form.name}</h3>
                  <p className="text-sm text-neutral-400 mt-1">{form.description}</p>
                  {form.status === 'ready' && (
                    <p className="text-xs text-green-400 mt-2">Bereit zum Download</p>
                  )}
                </div>
              </div>

              {form.status === 'ready' && (
                <button onClick={() => downloadForm(form)} className="btn-secondary">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Offnen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Generation button */}
      {!allReady && (
        <div className="border-t border-neutral-800 pt-6 mt-6">
          <button
            onClick={generateAll}
            className="btn-primary w-full py-4 text-lg"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <div className="spinner" />
                Formulare werden erstellt...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Alle Formulare generieren
              </>
            )}
          </button>
        </div>
      )}

      {/* Success state */}
      {allReady && (
        <div className="border-t border-neutral-800 pt-6 mt-6">
          <div className="card p-6 bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-800">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-900/50 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-white mb-2">Steuererklarung fertig!</h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Alle Formulare wurden erfolgreich erstellt. Folgen Sie der Schritt-fur-Schritt
                  Anleitung, um Ihre Steuererklarung bei FinanzOnline einzureichen.
                </p>
                <div className="flex items-center gap-3">
                  <button onClick={openOutputFolder} className="btn-secondary">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                      />
                    </svg>
                    Ordner offnen
                  </button>
                  <a
                    href="https://finanzonline.bmf.gv.at/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-accent"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    FinanzOnline offnen
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer navigation */}
      <div className="border-t border-neutral-800 pt-4 mt-4">
        <button onClick={() => navigate('/review')} className="btn-ghost">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zuruck zur Uberprufung
        </button>
      </div>
    </div>
  );
}

export default ExportPage;
