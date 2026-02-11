/**
 * TaxLogic.local - Global App Store (Zustand)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface LLMStatus {
  ollama: boolean;
  lmStudio: boolean;
  claude: boolean;
  openai: boolean;
  gemini: boolean;
  openaiCompatible: boolean;
}

export interface UserProfile {
  id?: string;
  profession?: string;
  incomeSource?: string;
  annualIncome?: number;
  employmentStatus?: 'employee' | 'freelancer' | 'business_owner' | 'retired' | 'other';
  location?: string;
  taxYear?: number;
  [key: string]: string | number | undefined;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  language: 'de' | 'en';
  preferredLLM: 'ollama' | 'lmStudio' | 'claude' | 'openai' | 'gemini' | 'openaiCompatible';
  ollamaUrl: string;
  ollamaModel: string;
  // API keys are NOT stored in localStorage (security risk)
  // They are managed via IPC settings:get/settings:set in the main process
  // Use window.electronAPI.invoke('settings:set', 'anthropicApiKey', key) to store
  // Use window.electronAPI.invoke('settings:get', 'anthropicApiKey') to retrieve
  openaiModel?: string;
  geminiModel?: string;
  openaiCompatibleUrl?: string;
  openaiCompatibleModel?: string;
}

interface AppState {
  // Onboarding
  isOnboarded: boolean;
  setOnboarded: (value: boolean) => void;

  // LLM Status
  llmStatus: LLMStatus;
  isCheckingLLM: boolean;
  checkLLMStatus: () => Promise<void>;

  // User Profile
  userProfile: UserProfile;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  resetUserProfile: () => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;

  // Current tax year session
  currentTaxYear: number;
  setCurrentTaxYear: (year: number) => void;

  // Navigation state
  currentStep: 'interview' | 'documents' | 'review' | 'export';
  setCurrentStep: (step: 'interview' | 'documents' | 'review' | 'export') => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'de',
  preferredLLM: 'ollama',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1:8b'
};

const defaultUserProfile: UserProfile = {
  taxYear: new Date().getFullYear() - 1 // Default to previous year (e.g., 2024 for filing in 2025)
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Onboarding
      isOnboarded: false,
      setOnboarded: (value) => set({ isOnboarded: value }),

      // LLM Status
      llmStatus: {
        ollama: false,
        lmStudio: false,
        claude: false,
        openai: false,
        gemini: false,
        openaiCompatible: false
      },
      isCheckingLLM: false,
      checkLLMStatus: async () => {
        set({ isCheckingLLM: true });
        try {
          if (window.electronAPI) {
            const status = await window.electronAPI.llm.checkStatus();
            set({ llmStatus: status });
          }
        } catch (error) {
          console.error('Failed to check LLM status:', error);
        } finally {
          set({ isCheckingLLM: false });
        }
      },

      // User Profile
      userProfile: defaultUserProfile,
      setUserProfile: (profile) =>
        set((state) => ({
          userProfile: { ...state.userProfile, ...profile }
        })),
      resetUserProfile: () => set({ userProfile: defaultUserProfile }),

      // Settings
      settings: defaultSettings,
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
        // Propagate LLM-relevant settings to main process
        if (window.electronAPI && (newSettings.ollamaUrl || newSettings.ollamaModel || newSettings.preferredLLM)) {
          const state = get();
          const merged = { ...state.settings, ...newSettings };
          window.electronAPI.invoke('llm:setConfig', {
            provider: merged.preferredLLM,
            ollamaBaseUrl: merged.ollamaUrl,
            ollamaModel: merged.ollamaModel
          }).catch((err: unknown) => console.error('Failed to sync LLM config:', err));
        }
      },
      resetSettings: () => set({ settings: defaultSettings }),

      // Current tax year
      currentTaxYear: new Date().getFullYear() - 1,
      setCurrentTaxYear: (year) => set({ currentTaxYear: year }),

      // Navigation
      currentStep: 'interview',
      setCurrentStep: (step) => set({ currentStep: step }),

      // Loading
      isLoading: false,
      setIsLoading: (value) => set({ isLoading: value }),
      loadingMessage: '',
      setLoadingMessage: (message) => set({ loadingMessage: message }),

      // Error
      error: null,
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Notifications
      notifications: [],
      addNotification: (type, message) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        set((state) => ({
          notifications: [
            ...state.notifications,
            { id, type, message, timestamp: Date.now() }
          ]
        }));
        // Auto-remove after 5 seconds
        setTimeout(() => {
          get().removeNotification(id);
        }, 5000);
      },
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        })),
      clearNotifications: () => set({ notifications: [] })
    }),
    {
      name: 'taxlogic-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isOnboarded: state.isOnboarded,
        userProfile: state.userProfile,
        settings: state.settings,
        currentTaxYear: state.currentTaxYear,
        currentStep: state.currentStep
      })
    }
  )
);
