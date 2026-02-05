/**
 * TaxLogic.local - Main App Component
 */

import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import OnboardingPage from './pages/OnboardingPage';
import InterviewPage from './pages/InterviewPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import ReviewPage from './pages/ReviewPage';
import ExportPage from './pages/ExportPage';
import SettingsPage from './pages/SettingsPage';
import { useAppStore } from './stores/appStore';

function App(): React.ReactElement {
  const { isOnboarded, checkLLMStatus } = useAppStore();

  useEffect(() => {
    // Check LLM status on app start
    checkLLMStatus();

    // Set up periodic status check
    const interval = setInterval(checkLLMStatus, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [checkLLMStatus]);

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          {/* Redirect to onboarding if not completed */}
          <Route
            path="/"
            element={
              isOnboarded ? (
                <Navigate to="/interview" replace />
              ) : (
                <Navigate to="/onboarding" replace />
              )
            }
          />

          {/* Onboarding (no layout) */}
          <Route
            path="/onboarding"
            element={
              <ErrorBoundary>
                <OnboardingPage />
              </ErrorBoundary>
            }
          />

          {/* Main app routes (with layout) */}
          <Route element={<Layout />}>
            <Route
              path="/interview"
              element={
                <ErrorBoundary>
                  <InterviewPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/documents"
              element={
                <ErrorBoundary>
                  <DocumentUploadPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/review"
              element={
                <ErrorBoundary>
                  <ReviewPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/export"
              element={
                <ErrorBoundary>
                  <ExportPage />
                </ErrorBoundary>
              }
            />
            <Route
              path="/settings"
              element={
                <ErrorBoundary>
                  <SettingsPage />
                </ErrorBoundary>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
