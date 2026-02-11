/**
 * TaxLogic.local - Review Page
 *
 * Review calculated deductions and tax analysis before export.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  const { setCurrentStep, addNotification } = useAppStore();

  const [analysis, setAnalysis] = useState<TaxAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const loadAnalysis = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (window.electronAPI) {
        // First try to get cached results
        let result = await window.electronAPI.invoke('analysis:getResults') as TaxAnalysis | null;

        // If no cached results exist, trigger calculation automatically
        if (!result || (typeof result === 'object' && !result.totalIncome && !result.totalDeductions)) {
          addNotification('info', 'Analyse wird berechnet...');
          try {
            result = await window.electronAPI.invoke('analysis:calculate') as TaxAnalysis | null;
          } catch (calcError) {
            console.warn('Auto-calculate failed:', calcError);
            // Continue with null result
          }
        }

        if (result && typeof result === 'object') {
          // Ensure all required fields have defaults
          setAnalysis({
            totalIncome: result.totalIncome || 0,
            totalDeductions: result.totalDeductions || 0,
            taxableIncome: result.taxableIncome || 0,
            estimatedTax: result.estimatedTax || 0,
            estimatedRefund: result.estimatedRefund || 0,
            deductions: Array.isArray(result.deductions) ? result.deductions : []
          });
        } else {
          setAnalysis(null);
        }
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
      addNotification('error', 'Analyse konnte nicht berechnet werden. Bitte zuerst das Interview abschliessen.');
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  const formatCurrency = (amount: number | null | undefined): string => {
    const value = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
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
          {(analysis.deductions || []).map((category) => (
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
                      {(category.items || []).map((item, index) => (
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
