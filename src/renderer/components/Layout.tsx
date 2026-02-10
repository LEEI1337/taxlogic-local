/**
 * TaxLogic.local - Main Layout Component
 */

import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAppStore } from '../stores/appStore';

import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import NotificationContainer from './NotificationContainer';

function Layout(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const { llmStatus, isCheckingLLM, notifications, removeNotification, checkLLMStatus, addNotification } = useAppStore();

  // Listen for menu events from main process
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanups: Array<() => void> = [];

    const menuHandlers: Record<string, () => void> = {
      'menu:openSettings': () => navigate('/settings'),
      'menu:startInterview': () => navigate('/interview'),
      'menu:manageDocuments': () => navigate('/documents'),
      'menu:runAnalysis': () => navigate('/review'),
      'menu:exportForms': () => navigate('/export'),
      'menu:generateForms': () => navigate('/export'),
      'menu:showGuide': () => navigate('/export'),
      'menu:checkLLMStatus': () => checkLLMStatus(),
      'menu:newFiling': () => {
        navigate('/interview');
        addNotification('info', 'Neue Steuererklärung gestartet');
      },
      'menu:save': () => addNotification('success', 'Gespeichert'),
      'menu:importDocuments': () => navigate('/documents'),
      'menu:showAbout': () => navigate('/settings')
    };

    for (const [channel, handler] of Object.entries(menuHandlers)) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanup = window.electronAPI.on(channel as any, handler);
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        }
      } catch {
        // Ignore channels not registered in preload
      }
    }

    return () => cleanups.forEach((c) => { try { c(); } catch { /* ignore */ } });
  }, [navigate, checkLLMStatus, addNotification]);

  // Get current page title
  const getPageTitle = (): string => {
    switch (location.pathname) {
      case '/interview':
        return 'Steuer-Interview';
      case '/documents':
        return 'Dokumente';
      case '/review':
        return 'Uberprufung';
      case '/export':
        return 'Export';
      case '/settings':
        return 'Einstellungen';
      default:
        return 'TaxLogic.local';
    }
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-900/50 backdrop-blur-sm">
          <h1 className="text-lg font-semibold">{getPageTitle()}</h1>

          {/* LLM Status Indicator */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-neutral-400">LLM:</span>
              {isCheckingLLM ? (
                <div className="spinner" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <div
                    className={`status-dot ${
                      llmStatus.ollama || llmStatus.lmStudio || llmStatus.claude
                        ? 'status-dot-online'
                        : 'status-dot-offline'
                    }`}
                  />
                  <span className="text-neutral-300">
                    {llmStatus.ollama
                      ? 'Ollama'
                      : llmStatus.lmStudio
                      ? 'LM Studio'
                      : llmStatus.claude
                      ? 'Claude'
                      : 'Offline'}
                  </span>
                </div>
              )}
            </div>

            {/* Settings button */}
            <button
              onClick={() => navigate('/settings')}
              className="btn-ghost p-2 rounded-lg"
              title="Einstellungen"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>

        {/* Status Bar */}
        <StatusBar />
      </div>

      {/* Notifications */}
      <NotificationContainer
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
}

export default Layout;
