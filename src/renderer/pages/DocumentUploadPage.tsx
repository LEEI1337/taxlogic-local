/**
 * TaxLogic.local - Document Upload Page
 *
 * Upload and manage tax-related documents (receipts, invoices, etc.)
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppStore } from '../stores/appStore';

interface UploadedDocument {
  id: string;
  name: string;
  path: string;
  size: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  category?: string;
  extractedData?: {
    date?: string;
    amount?: number;
    vendor?: string;
  };
}

function DocumentUploadPage(): React.ReactElement {
  const navigate = useNavigate();
  const { setCurrentStep, addNotification } = useAppStore();

  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = useCallback(async (files: Array<File | { name: string; path: string }>): Promise<void> => {
    const newDocs: UploadedDocument[] = files.map((file, index) => ({
      id: `doc-${Date.now()}-${index}`,
      name: file.name,
      path: 'path' in file ? file.path : URL.createObjectURL(file as File),
      size: 'size' in file ? (file as File).size : 0,
      status: 'uploading' as const
    }));

    setDocuments((prev) => [...prev, ...newDocs]);

    // Simulate processing each document
    for (const doc of newDocs) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? { ...d, status: 'processing' as const }
            : d
        )
      );

      // Simulate OCR & classification
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update with results
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? {
                ...d,
                status: 'done' as const,
                category: 'Werbungskosten',
                extractedData: {
                  date: '2024-03-15',
                  amount: 42.50,
                  vendor: 'Example Vendor'
                }
              }
            : d
        )
      );
    }

    addNotification('success', `${files.length} Dokument(e) erfolgreich verarbeitet`);
  }, [addNotification]);

  const handleDragEnter = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback(async (e: React.DragEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  }, [processFiles]);

  const handleFileSelect = async (): Promise<void> => {
    if (window.electronAPI) {
      const filePaths = await window.electronAPI.fs.selectFiles([
        { name: 'Dokumente', extensions: ['pdf', 'png', 'jpg', 'jpeg'] }
      ]);

      if (filePaths) {
        // Convert paths to pseudo-File objects for processing
        const pseudoFiles: Array<{ name: string; path: string }> = filePaths.map((path) => ({
          name: path.split(/[/\\]/).pop() || 'unknown',
          path
        }));

        await processFiles(pseudoFiles);
      }
    }
  };

  const removeDocument = (id: string): void => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const organizeDocuments = async (): Promise<void> => {
    setIsProcessing(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.documents.organize();
      }
      addNotification('success', 'Dokumente wurden organisiert');
    } catch (error) {
      addNotification('error', 'Fehler beim Organisieren der Dokumente');
    } finally {
      setIsProcessing(false);
    }
  };

  const proceedToReview = (): void => {
    setCurrentStep('review');
    navigate('/review');
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      Reisekosten: 'bg-blue-900/50 text-blue-400 border-blue-800',
      'Home Office': 'bg-purple-900/50 text-purple-400 border-purple-800',
      Fortbildung: 'bg-green-900/50 text-green-400 border-green-800',
      Medizin: 'bg-red-900/50 text-red-400 border-red-800',
      Sonstige: 'bg-neutral-800 text-neutral-400 border-neutral-700'
    };
    return colors[category] || colors.Sonstige;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Upload area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`dropzone mb-6 ${isDragging ? 'dropzone-active' : ''}`}
      >
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <h3 className="text-lg font-medium text-white mb-2">
            Dokumente hier ablegen
          </h3>
          <p className="text-neutral-400 mb-4">
            oder
          </p>
          <button onClick={handleFileSelect} className="btn-secondary">
            Dateien auswahlen
          </button>
          <p className="text-xs text-neutral-500 mt-4">
            Unterstutzte Formate: PDF, PNG, JPG
          </p>
        </div>
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-white">
              {documents.length} Dokument{documents.length !== 1 ? 'e' : ''}
            </h3>
            <button
              onClick={organizeDocuments}
              className="btn-ghost text-sm"
              disabled={isProcessing || documents.some((d) => d.status !== 'done')}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              Automatisch organisieren
            </button>
          </div>

          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="card p-4 flex items-center gap-4"
              >
                {/* Document icon */}
                <div className="w-12 h-12 rounded-lg bg-neutral-700 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>

                {/* Document info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">{doc.name}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    {doc.status === 'done' && doc.category && (
                      <span className={`badge border ${getCategoryColor(doc.category)}`}>
                        {doc.category}
                      </span>
                    )}
                    {doc.status === 'done' && doc.extractedData && (
                      <span className="text-xs text-neutral-500">
                        {doc.extractedData.amount} EUR | {doc.extractedData.date}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status / Actions */}
                <div className="flex items-center gap-2">
                  {doc.status === 'uploading' && (
                    <span className="text-sm text-neutral-400">Hochladen...</span>
                  )}
                  {doc.status === 'processing' && (
                    <div className="flex items-center gap-2 text-sm text-accent-400">
                      <div className="spinner w-4 h-4" />
                      OCR...
                    </div>
                  )}
                  {doc.status === 'done' && (
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {doc.status === 'error' && (
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}

                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="btn-ghost p-1.5 text-neutral-500 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {documents.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-neutral-500">
            <p>Noch keine Dokumente hochgeladen</p>
            <p className="text-sm mt-1">
              Laden Sie Belege, Rechnungen und andere Steuerdokumente hoch
            </p>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="border-t border-neutral-800 pt-4 mt-4 flex items-center justify-between">
        <button onClick={() => navigate('/interview')} className="btn-ghost">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zuruck zum Interview
        </button>

        <button
          onClick={proceedToReview}
          className="btn-primary"
          disabled={documents.some((d) => d.status !== 'done')}
        >
          Weiter zur Uberprufung
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default DocumentUploadPage;
