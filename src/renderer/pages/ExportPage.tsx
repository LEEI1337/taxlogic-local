/**
 * TaxLogic.local - Export Page
 *
 * Export tax forms and step-by-step guide.
 * Calls real backend services (FormGenerator, GuideGenerator) via IPC.
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
  errorMessage?: string;
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
      name: 'Schritt-fuer-Schritt Anleitung',
      description: 'Personalisierte Anleitung fuer Ihre Steuererklaerung',
      status: 'pending'
    }
  ]);

  const [isGenerating, setIsGenerating] = useState(false);

  const generateAll = async (): Promise<void> => {
    setIsGenerating(true);

    // Work on a copy of the current forms list
    const currentForms = [...forms];

    for (const form of currentForms) {
      // Set status to generating
      setForms((prev) =>
        prev.map((f) => (f.id === form.id ? { ...f, status: 'generating', errorMessage: undefined } : f))
      );

      try {
        let resultPath = '';

        if (window.electronAPI) {
          if (form.id === 'guide') {
            // Generate guide via IPC - returns markdown/path
            resultPath = await window.electronAPI.guide.generate();
          } else {
            // Generate tax form (L1, L1ab) via IPC - returns PDF path
            resultPath = await window.electronAPI.forms.generate(form.id);
          }
        }

        setForms((prev) =>
          prev.map((f) =>
            f.id === form.id
              ? { ...f, status: 'ready', path: resultPath || undefined }
              : f
          )
        );
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
        console.error(`Error generating ${form.id}:`, error);
        setForms((prev) =>
          prev.map((f) =>
            f.id === form.id ? { ...f, status: 'error', errorMessage: errMsg } : f
          )
        );
        addNotification('error', `Fehler beim Erstellen von ${form.name}: ${errMsg}`);
      }
    }

    setIsGenerating(false);

    // Check if all forms generated successfully
    setForms((prev) => {
      const allGood = prev.every((f) => f.status === 'ready');
      if (allGood) {
        addNotification('success', 'Alle Formulare wurden erfolgreich erstellt');
      }
      return prev;
    });
  };

  const downloadForm = async (form: ExportForm): Promise<void> => {
    if (!window.electronAPI) {
      addNotification('error', 'Electron API nicht verfuegbar');
      return;
    }

    if (!form.path) {
      addNotification('error', 'Datei nicht verfuegbar - bitte zuerst generieren');
      return;
    }

    try {
      // Show save dialog so user can choose where to save
      const savePath = await window.electronAPI.fs.saveFile(
        `${form.id}_${currentTaxYear}.pdf`,
        [{ name: 'PDF Dateien', extensions: ['pdf'] }]
      );

      if (savePath) {
        // Export/copy the file to the user-chosen location
        if (form.id === 'guide') {
          await window.electronAPI.guide.export(savePath);
        } else {
          await window.electronAPI.forms.export(form.id, savePath);
        }
        addNotification('success', `${form.name} wurde gespeichert`);
      }
      // If savePath is null, user cancelled the dialog - no action needed
    } catch (error) {
      console.error('Download error:', error);
      const errMsg = error instanceof Error ? error.message : 'Unbekannter Fehler';
      addNotification('error', `Fehler beim Speichern: ${errMsg}`);
    }
  };

  const viewForm = async (form: ExportForm): Promise<void> => {
    if (!window.electronAPI || !form.path) return;
    try {
      await window.electronAPI.fs.openPath(form.path);
    } catch (error) {
      console.error('Error opening file:', error);
      addNotification('error', 'Datei konnte nicht geoeffnet werden');
    }
  };

  const openOutputFolder = async (): Promise<void> => {
    if (window.electronAPI) {
      try {
        const userDataPath = await window.electronAPI.getUserDataPath();
        await window.electronAPI.fs.openPath(`${userDataPath}/output`);
      } catch (error) {
        console.error('Error opening output folder:', error);
        addNotification('error', 'Ordner konnte nicht geoeffnet werden');
      }
    }
  };

  const allReady = forms.every((f) => f.status === 'ready');
  const hasErrors = forms.some((f) => f.status === 'error');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          Steuererklaerung {currentTaxYear} exportieren
        </h2>
        <p className="text-neutral-400">
          Generieren Sie Ihre Steuerformulare und die personalisierte Anleitung zum Ausfuellen.
        </p>
      </div>

      {/* Form list */}
      <div className="flex-1 space-y-4">
        {forms.map((form) => (
          <div
            key={form.id}
            className={`card p-6 transition-all ${
              form.status === 'ready'
                ? 'border-green-800'
                : form.status === 'error'
                ? 'border-red-800'
                : ''
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
                      : form.status === 'error'
                      ? 'bg-red-900/50'
                      : 'bg-neutral-800'
                  }`}
                >
                  {form.status === 'generating' ? (
                    <div className="spinner" />
                  ) : form.status === 'ready' ? (
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : form.status === 'error' ? (
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                  {form.status === 'error' && (
                    <p className="text-xs text-red-400 mt-2">
                      Fehler: {form.errorMessage || 'Generierung fehlgeschlagen'}
                    </p>
                  )}
                </div>
              </div>

              {form.status === 'ready' && (
                <div className="flex items-center gap-2">
                  <button onClick={() => viewForm(form)} className="btn-ghost text-sm" title="Vorschau anzeigen">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    Anzeigen
                  </button>
                  <button onClick={() => downloadForm(form)} className="btn-secondary">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Speichern
                  </button>
                </div>
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
                {hasErrors ? 'Erneut generieren' : 'Alle Formulare generieren'}
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
                <h3 className="font-medium text-white mb-2">Steuererklaerung fertig!</h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Alle Formulare wurden erfolgreich erstellt. Folgen Sie der Schritt-fuer-Schritt
                  Anleitung, um Ihre Steuererklaerung bei FinanzOnline einzureichen.
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
                    Ordner oeffnen
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
                    FinanzOnline oeffnen
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
          Zurueck zur Ueberpruefung
        </button>
      </div>
    </div>
  );
}

export default ExportPage;
