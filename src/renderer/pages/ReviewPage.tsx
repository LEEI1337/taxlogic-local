/**
 * TaxLogic.local - Review Page
 *
 * Review calculated deductions and tax analysis before export.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';

interface DeductionCategory {
  name: string;
  amount: number;
  items: Array<{
    description: string;
    amount: number;
    date: string;
  }>;
}

interface TaxAnalysis {
  totalIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  estimatedTax: number;
  estimatedRefund: number;
  deductions: DeductionCategory[];
}

function ReviewPage(): React.ReactElement {
  const navigate = useNavigate();
  const { currentTaxYear, setCurrentStep, addNotification } = useAppStore();

  const [analysis, setAnalysis] = useState<TaxAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Simulate loading analysis
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock analysis data
      setAnalysis({
        totalIncome: 52000,
        totalDeductions: 4850,
        taxableIncome: 47150,
        estimatedTax: 12500,
        estimatedRefund: 1420,
        deductions: [
          {
            name: 'Pendlerkilometer',
            amount: 2100,
            items: [
              { description: 'Tagliche Pendelstrecke 35km', amount: 2100, date: '2024' }
            ]
          },
          {
            name: 'Home Office',
            amount: 900,
            items: [
              { description: 'Home Office Pauschale (150 Tage)', amount: 900, date: '2024' }
            ]
          },
          {
            name: 'Fortbildung',
            amount: 850,
            items: [
              { description: 'Online-Kurs TypeScript', amount: 299, date: '2024-03-15' },
              { description: 'Fachbuch React', amount: 51, date: '2024-05-20' },
              { description: 'Konferenz-Ticket', amount: 500, date: '2024-09-10' }
            ]
          },
          {
            name: 'Kirchenbeitrag',
            amount: 400,
            items: [
              { description: 'Romisch-Katholische Kirche', amount: 400, date: '2024' }
            ]
          },
          {
            name: 'Sonstige',
            amount: 600,
            items: [
              { description: 'Arbeitsmittel (Headset, Maus)', amount: 150, date: '2024-02-10' },
              { description: 'Spende Caritas', amount: 200, date: '2024-06-01' },
              { description: 'Spende Rotes Kreuz', amount: 250, date: '2024-12-15' }
            ]
          }
        ]
      });
    } catch (error) {
      addNotification('error', 'Fehler beim Laden der Analyse');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const proceedToExport = (): void => {
    setCurrentStep('export');
    navigate('/export');
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-neutral-400">Analyse wird berechnet...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400">Keine Analysedaten verfugbar</p>
          <button onClick={() => navigate('/interview')} className="btn-primary mt-4">
            Zuruck zum Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-sm text-neutral-400 mb-1">Bruttoeinkommen</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(analysis.totalIncome)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-neutral-400 mb-1">Absetzungen</p>
          <p className="text-2xl font-bold text-green-400">-{formatCurrency(analysis.totalDeductions)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-neutral-400 mb-1">Zu versteuern</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(analysis.taxableIncome)}</p>
        </div>
        <div className="card p-4 bg-gradient-to-br from-green-900/50 to-green-900/20 border-green-800">
          <p className="text-sm text-green-400 mb-1">Geschatzte Ruckerstattung</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(analysis.estimatedRefund)}</p>
        </div>
      </div>

      {/* Deduction breakdown */}
      <div className="flex-1 overflow-y-auto">
        <h3 className="font-medium text-white mb-4">Absetzungen im Detail</h3>

        <div className="space-y-3">
          {analysis.deductions.map((category) => (
            <div key={category.name} className="card overflow-hidden">
              <button
                onClick={() =>
                  setExpandedCategory(expandedCategory === category.name ? null : category.name)
                }
                className="w-full p-4 flex items-center justify-between hover:bg-neutral-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-white">{category.name}</h4>
                    <p className="text-sm text-neutral-500">
                      {category.items.length} Position{category.items.length !== 1 ? 'en' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-medium text-green-400">
                    {formatCurrency(category.amount)}
                  </span>
                  <svg
                    className={`w-5 h-5 text-neutral-500 transition-transform ${
                      expandedCategory === category.name ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedCategory === category.name && (
                <div className="border-t border-neutral-700 px-4 py-3 bg-neutral-800/30">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-neutral-500 uppercase">
                        <th className="text-left py-2">Beschreibung</th>
                        <th className="text-left py-2">Datum</th>
                        <th className="text-right py-2">Betrag</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {category.items.map((item, index) => (
                        <tr key={index} className="border-t border-neutral-700/50">
                          <td className="py-2 text-white">{item.description}</td>
                          <td className="py-2 text-neutral-400">{item.date}</td>
                          <td className="py-2 text-right text-white">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-neutral-800 pt-4 mt-4 flex items-center justify-between">
        <button onClick={() => navigate('/documents')} className="btn-ghost">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zuruck zu Dokumenten
        </button>

        <div className="flex items-center gap-3">
          <button onClick={loadAnalysis} className="btn-secondary">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Neu berechnen
          </button>

          <button onClick={proceedToExport} className="btn-primary">
            Formulare erstellen
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewPage;
