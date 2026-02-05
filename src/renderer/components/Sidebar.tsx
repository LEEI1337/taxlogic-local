/**
 * TaxLogic.local - Sidebar Navigation Component
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAppStore } from '../stores/appStore';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  step: 'interview' | 'documents' | 'review' | 'export';
}

function Sidebar(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentTaxYear, currentStep } = useAppStore();

  const navItems: NavItem[] = [
    {
      path: '/interview',
      label: 'Interview',
      step: 'interview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      )
    },
    {
      path: '/documents',
      label: 'Dokumente',
      step: 'documents',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      )
    },
    {
      path: '/review',
      label: 'Uberprufung',
      step: 'review',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      )
    },
    {
      path: '/export',
      label: 'Export',
      step: 'export',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
      )
    }
  ];

  const stepOrder = ['interview', 'documents', 'review', 'export'];

  const isStepAccessible = (step: string): boolean => {
    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(step);
    return targetIndex <= currentIndex + 1;
  };

  return (
    <aside className="w-64 bg-neutral-850 border-r border-neutral-800 flex flex-col">
      {/* Logo */}
      <div className="h-14 border-b border-neutral-800 flex items-center px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-white">TaxLogic</h2>
            <p className="text-xs text-neutral-500">.local</p>
          </div>
        </div>
      </div>

      {/* Tax Year Selector */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <label className="text-xs text-neutral-500 uppercase tracking-wider">Steuerjahr</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-2xl font-bold text-white">{currentTaxYear}</span>
          <span className="badge badge-info">Aktuell</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 text-xs text-neutral-500 uppercase tracking-wider mb-2">
          Workflow
        </p>
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          const isAccessible = isStepAccessible(item.step);

          return (
            <button
              key={item.path}
              onClick={() => isAccessible && navigate(item.path)}
              disabled={!isAccessible}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-accent-600/20 text-accent-400 border-l-2 border-accent-500'
                  : isAccessible
                  ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  : 'text-neutral-600 cursor-not-allowed'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  isActive
                    ? 'bg-accent-600 text-white'
                    : isAccessible
                    ? 'bg-neutral-700 text-neutral-400'
                    : 'bg-neutral-800 text-neutral-600'
                }`}
              >
                {index + 1}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-neutral-800">
        <div className="card p-3 bg-neutral-800/50">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs font-medium text-neutral-300">Tipp</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Beantworten Sie die Fragen so genau wie moglich, um die beste Steueroptimierung zu erhalten.
          </p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
