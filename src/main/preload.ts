/**
 * TaxLogic.local - Preload Script
 *
 * This script runs in an isolated context before the renderer process loads.
 * It exposes a secure bridge between the main process and renderer via contextBridge.
 *
 * Security: Only expose what's necessary. Never expose ipcRenderer directly.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

/**
 * Allowed IPC channels for security
 */
const ALLOWED_INVOKE_CHANNELS = [
  // Window management
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:isMaximized',

  // App info
  'app:getVersion',
  'app:getUserDataPath',
  'app:getPlatform',

  // LLM operations
  'llm:checkStatus',
  'llm:getAvailableModels',
  'llm:setModel',
  'llm:setConfig',
  'llm:query',
  'llm:queryStream',

  // Interview operations
  'interview:start',
  'interview:continue',
  'interview:getProfile',
  'interview:save',
  'interview:load',

  // Document operations
  'documents:upload',
  'documents:process',
  'documents:organize',
  'documents:getManifest',
  'documents:delete',

  // Analysis operations
  'analysis:calculate',
  'analysis:getResults',
  'analysis:optimize',

  // Form operations
  'forms:generate',
  'forms:preview',
  'forms:export',
  'forms:getAvailable',

  // Guide operations
  'guide:generate',
  'guide:export',

  // Database operations
  'db:getUserProfile',
  'db:saveUserProfile',
  'db:getInterviews',
  'db:getDocuments',
  'db:getExpenses',

  // File system
  'fs:selectDirectory',
  'fs:selectFiles',
  'fs:openPath',

  // Settings
  'settings:get',
  'settings:set',
  'settings:getAll',
  'settings:reset',

  // Secure API Key Storage
  'apiKeys:get',
  'apiKeys:set',
  'apiKeys:getAll'
] as const;

const ALLOWED_ON_CHANNELS = [
  // Window state changes
  'window:stateChanged',

  // LLM streaming
  'llm:streamChunk',
  'llm:streamEnd',
  'llm:streamError',

  // Progress updates
  'progress:update',
  'progress:complete',
  'progress:error',

  // Notifications
  'notification:show',

  // Interview updates
  'interview:questionReceived',
  'interview:completed',

  // Menu events (from application menu)
  'menu:newFiling',
  'menu:openFiling',
  'menu:save',
  'menu:saveAs',
  'menu:importDocuments',
  'menu:exportForms',
  'menu:openSettings',
  'menu:startInterview',
  'menu:manageDocuments',
  'menu:runAnalysis',
  'menu:generateForms',
  'menu:showGuide',
  'menu:checkLLMStatus',
  'menu:showAbout'
] as const;

type InvokeChannel = typeof ALLOWED_INVOKE_CHANNELS[number];
type OnChannel = typeof ALLOWED_ON_CHANNELS[number];

/**
 * Type definitions for the exposed API
 */
export interface IElectronAPI {
  // Window management
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // App info
  getVersion: () => Promise<string>;
  getUserDataPath: () => Promise<string>;
  getPlatform: () => Promise<NodeJS.Platform>;

  // Generic IPC methods
  invoke: (channel: InvokeChannel, ...args: unknown[]) => Promise<unknown>;
  on: (channel: OnChannel, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => () => void;
  once: (channel: OnChannel, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => void;
  removeAllListeners: (channel: OnChannel) => void;

  // LLM operations
  llm: {
    checkStatus: () => Promise<{
      ollama: boolean;
      lmStudio: boolean;
      claude: boolean;
      openai: boolean;
      gemini: boolean;
      openaiCompatible: boolean;
    }>;
    getAvailableModels: () => Promise<string[]>;
    setModel: (modelName: string) => Promise<void>;
    query: (prompt: string, conversationHistory?: Array<{ role: string; content: string }>) => Promise<string>;
  };

  // Interview operations
  interview: {
    start: (userProfile: Record<string, unknown>) => Promise<{
      message: string;
      question: Record<string, unknown> | null;
      interviewId: string;
    }>;
    continue: (userInput: string) => Promise<{
      message: string;
      question: Record<string, unknown> | null;
      isComplete: boolean;
      validationError?: string;
    }>;
    getProfile: () => Promise<Record<string, unknown>>;
    save: (data: Record<string, unknown>) => Promise<void>;
    load: (id: string) => Promise<Record<string, unknown>>;
  };

  // Document operations
  documents: {
    upload: (filePaths: string[]) => Promise<Array<{ id: string; path: string; status: string }>>;
    process: (documentId: string) => Promise<Record<string, unknown>>;
    organize: () => Promise<Record<string, unknown>>;
    getManifest: () => Promise<Record<string, unknown>>;
  };

  // Form operations
  forms: {
    generate: (formType: string) => Promise<string>;
    preview: (formType: string) => Promise<string>;
    export: (formType: string, outputPath: string) => Promise<void>;
  };

  // File system
  fs: {
    selectDirectory: () => Promise<string | null>;
    selectFiles: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string[] | null>;
    openPath: (path: string) => Promise<void>;
  };
}

// Expose the API to the renderer process
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

    // App info
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

    // Generic IPC invoke (with channel validation)
    invoke: (channel: InvokeChannel, ...args: unknown[]) => {
      if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(`IPC channel "${channel}" is not allowed`);
    },

    // Event listeners (with channel validation)
    on: (channel: OnChannel, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
      if (ALLOWED_ON_CHANNELS.includes(channel)) {
        const subscription = (event: IpcRendererEvent, ...args: unknown[]) => callback(event, ...args);
        ipcRenderer.on(channel, subscription);
        // Return unsubscribe function
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
      throw new Error(`IPC channel "${channel}" is not allowed`);
    },

    once: (channel: OnChannel, callback: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
      if (ALLOWED_ON_CHANNELS.includes(channel)) {
        ipcRenderer.once(channel, callback);
      } else {
        throw new Error(`IPC channel "${channel}" is not allowed`);
      }
    },

    removeAllListeners: (channel: OnChannel) => {
      if (ALLOWED_ON_CHANNELS.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
    },

    // LLM operations
    llm: {
      checkStatus: () => ipcRenderer.invoke('llm:checkStatus'),
      getAvailableModels: () => ipcRenderer.invoke('llm:getAvailableModels'),
      setModel: (modelName: string) => ipcRenderer.invoke('llm:setModel', modelName),
      query: (prompt: string, conversationHistory?: Array<{ role: string; content: string }>) =>
        ipcRenderer.invoke('llm:query', prompt, conversationHistory)
    },

    // Interview operations
    interview: {
      start: (userProfile: Record<string, unknown>) => ipcRenderer.invoke('interview:start', userProfile),
      continue: (userInput: string) => ipcRenderer.invoke('interview:continue', userInput),
      getProfile: () => ipcRenderer.invoke('interview:getProfile'),
      save: (data: Record<string, unknown>) => ipcRenderer.invoke('interview:save', data),
      load: (id: string) => ipcRenderer.invoke('interview:load', id)
    },

    // Document operations
    documents: {
      upload: (filePaths: string[]) => ipcRenderer.invoke('documents:upload', filePaths),
      process: (documentId: string) => ipcRenderer.invoke('documents:process', documentId),
      organize: () => ipcRenderer.invoke('documents:organize'),
      getManifest: () => ipcRenderer.invoke('documents:getManifest')
    },

    // Form operations
    forms: {
      generate: (formType: string) => ipcRenderer.invoke('forms:generate', formType),
      preview: (formType: string) => ipcRenderer.invoke('forms:preview', formType),
      export: (formType: string, outputPath: string) => ipcRenderer.invoke('forms:export', formType, outputPath)
    },

    // File system
    fs: {
      selectDirectory: () => ipcRenderer.invoke('fs:selectDirectory'),
      selectFiles: (filters?: Array<{ name: string; extensions: string[] }>) =>
        ipcRenderer.invoke('fs:selectFiles', filters),
      openPath: (path: string) => ipcRenderer.invoke('fs:openPath', path)
    }
  } as IElectronAPI);
} catch (error) {
  console.error('Failed to expose electronAPI:', error);
}

// Type declaration for global window object
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
