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
            element={<OnboardingPage />}
          />

          {/* Main app routes (with layout) */}
          <Route element={<Layout />}>
            <Route
              path="/interview"
              element={<InterviewPage />}
            />
            <Route
              path="/documents"
              element={<DocumentUploadPage />}
            />
            <Route
              path="/review"
              element={<ReviewPage />}
            />
            <Route
              path="/export"
              element={<ExportPage />}
            />
            <Route
              path="/settings"
              element={<SettingsPage />}
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
