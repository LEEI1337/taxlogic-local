/**
 * TaxLogic.local - IPC Handlers
 *
 * Registers all IPC handlers for communication between main and renderer processes.
 */

import { ipcMain, app, dialog, shell, BrowserWindow } from 'electron';
import path from 'path';
import { logger } from './utils/logger';

// Service instances will be imported once created
// import { llmService } from '@services/llmService';
// import { dbService } from '@services/dbService';
// import { interviewService } from '@services/interviewService';
// import { documentService } from '@services/documentService';
// import { formService } from '@services/formService';

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers(): void {
  logger.info('Registering IPC handlers...');

  // ========================================
  // Window Management
  // ========================================

  ipcMain.handle('window:minimize', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  });

  ipcMain.handle('window:maximize', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle('window:close', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.close();
  });

  ipcMain.handle('window:isMaximized', async () => {
    const win = BrowserWindow.getFocusedWindow();
    return win ? win.isMaximized() : false;
  });

  // ========================================
  // App Information
  // ========================================

  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getUserDataPath', async () => {
    return app.getPath('userData');
  });

  ipcMain.handle('app:getPlatform', async () => {
    return process.platform;
  });

  // ========================================
  // LLM Operations
  // ========================================

  ipcMain.handle('llm:checkStatus', async () => {
    logger.debug('Checking LLM status...');
    // TODO: Implement actual LLM status check
    try {
      // Check Ollama
      const ollamaStatus = await checkOllamaStatus();

      // Check LM Studio
      const lmStudioStatus = await checkLMStudioStatus();

      // Check Claude (if API key is set)
      const claudeStatus = await checkClaudeStatus();

      return {
        ollama: ollamaStatus,
        lmStudio: lmStudioStatus,
        claude: claudeStatus
      };
    } catch (error) {
      logger.error('Error checking LLM status:', error);
      return {
        ollama: false,
        lmStudio: false,
        claude: false
      };
    }
  });

  ipcMain.handle('llm:getAvailableModels', async () => {
    logger.debug('Getting available models...');
    // TODO: Implement actual model listing
    return ['mistral:latest', 'llama2:latest', 'nomic-embed-text:latest'];
  });

  ipcMain.handle('llm:setModel', async (_event, modelName: string) => {
    logger.info('Setting model to:', modelName);
    // TODO: Implement model selection
  });

  ipcMain.handle('llm:query', async (_event, prompt: string, conversationHistory?: Array<{ role: string; content: string }>) => {
    logger.debug('LLM query received');
    // TODO: Implement actual LLM query
    return 'This is a placeholder response. LLM integration coming soon.';
  });

  // ========================================
  // Interview Operations
  // ========================================

  ipcMain.handle('interview:start', async (_event, userProfile: Record<string, unknown>) => {
    logger.info('Starting interview...');
    // TODO: Implement interview start
    return 'Willkommen! Ich bin Ihr personlicher Steuerberater. Lassen Sie uns mit einigen Fragen zu Ihrer beruflichen Situation beginnen. Was ist Ihr aktueller Beruf?';
  });

  ipcMain.handle('interview:continue', async (_event, userInput: string) => {
    logger.debug('Continuing interview with input:', userInput);
    // TODO: Implement interview continuation
    return 'Danke fur Ihre Antwort. Als nachstes mochte ich wissen: Wie viele Kilometer pendeln Sie taglich zur Arbeit?';
  });

  ipcMain.handle('interview:getProfile', async () => {
    logger.debug('Getting interview profile...');
    // TODO: Implement profile retrieval
    return {};
  });

  ipcMain.handle('interview:save', async (_event, data: Record<string, unknown>) => {
    logger.info('Saving interview data...');
    // TODO: Implement interview save
  });

  ipcMain.handle('interview:load', async (_event, id: string) => {
    logger.info('Loading interview:', id);
    // TODO: Implement interview load
    return {};
  });

  // ========================================
  // Document Operations
  // ========================================

  ipcMain.handle('documents:upload', async (_event, filePaths: string[]) => {
    logger.info('Uploading documents:', filePaths.length, 'files');
    // TODO: Implement document upload
    return filePaths.map((p, i) => ({
      id: `doc-${i}`,
      path: p,
      status: 'uploaded'
    }));
  });

  ipcMain.handle('documents:process', async (_event, documentId: string) => {
    logger.info('Processing document:', documentId);
    // TODO: Implement OCR processing
    return {
      id: documentId,
      status: 'processed',
      extractedData: {}
    };
  });

  ipcMain.handle('documents:organize', async () => {
    logger.info('Organizing documents...');
    // TODO: Implement document organization
    return {
      organized: true,
      categories: {}
    };
  });

  ipcMain.handle('documents:getManifest', async () => {
    logger.debug('Getting document manifest...');
    // TODO: Implement manifest retrieval
    return {
      documents: [],
      lastUpdated: new Date().toISOString()
    };
  });

  // ========================================
  // Analysis Operations
  // ========================================

  ipcMain.handle('analysis:calculate', async () => {
    logger.info('Performing tax analysis...');
    // TODO: Implement tax calculation
    return {
      totalIncome: 0,
      totalDeductions: 0,
      estimatedRefund: 0
    };
  });

  ipcMain.handle('analysis:getResults', async () => {
    logger.debug('Getting analysis results...');
    // TODO: Implement results retrieval
    return {};
  });

  ipcMain.handle('analysis:optimize', async () => {
    logger.info('Optimizing deductions...');
    // TODO: Implement optimization
    return {
      suggestions: []
    };
  });

  // ========================================
  // Form Operations
  // ========================================

  ipcMain.handle('forms:generate', async (_event, formType: string) => {
    logger.info('Generating form:', formType);
    // TODO: Implement form generation
    return path.join(app.getPath('userData'), 'output', `${formType}_2024.pdf`);
  });

  ipcMain.handle('forms:preview', async (_event, formType: string) => {
    logger.debug('Previewing form:', formType);
    // TODO: Implement form preview
    return '';
  });

  ipcMain.handle('forms:export', async (_event, formType: string, outputPath: string) => {
    logger.info('Exporting form:', formType, 'to', outputPath);
    // TODO: Implement form export
  });

  ipcMain.handle('forms:getAvailable', async () => {
    return ['L1', 'L1ab', 'L1k'];
  });

  // ========================================
  // Guide Operations
  // ========================================

  ipcMain.handle('guide:generate', async () => {
    logger.info('Generating step-by-step guide...');
    // TODO: Implement guide generation
    return '# Ihre personliche Steueranleitung\n\n...';
  });

  ipcMain.handle('guide:export', async (_event, outputPath: string) => {
    logger.info('Exporting guide to:', outputPath);
    // TODO: Implement guide export
  });

  // ========================================
  // Database Operations
  // ========================================

  ipcMain.handle('db:getUserProfile', async () => {
    logger.debug('Getting user profile from database...');
    // TODO: Implement database query
    return null;
  });

  ipcMain.handle('db:saveUserProfile', async (_event, profile: Record<string, unknown>) => {
    logger.info('Saving user profile to database...');
    // TODO: Implement database save
  });

  ipcMain.handle('db:getInterviews', async () => {
    logger.debug('Getting interviews from database...');
    // TODO: Implement database query
    return [];
  });

  ipcMain.handle('db:getDocuments', async () => {
    logger.debug('Getting documents from database...');
    // TODO: Implement database query
    return [];
  });

  ipcMain.handle('db:getExpenses', async () => {
    logger.debug('Getting expenses from database...');
    // TODO: Implement database query
    return [];
  });

  // ========================================
  // File System Operations
  // ========================================

  ipcMain.handle('fs:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Ordner auswahlen'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('fs:selectFiles', async (_event, filters?: Array<{ name: string; extensions: string[] }>) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Dateien auswahlen',
      filters: filters || [
        { name: 'Dokumente', extensions: ['pdf', 'png', 'jpg', 'jpeg'] },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths;
  });

  ipcMain.handle('fs:openPath', async (_event, filePath: string) => {
    await shell.openPath(filePath);
  });

  // ========================================
  // Settings Operations
  // ========================================

  ipcMain.handle('settings:get', async (_event, key: string) => {
    logger.debug('Getting setting:', key);
    // TODO: Implement settings retrieval
    return null;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: unknown) => {
    logger.info('Setting:', key, '=', value);
    // TODO: Implement settings save
  });

  ipcMain.handle('settings:reset', async () => {
    logger.info('Resetting all settings...');
    // TODO: Implement settings reset
  });

  logger.info('IPC handlers registered successfully');
}

// ========================================
// Helper Functions
// ========================================

async function checkOllamaStatus(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkLMStudioStatus(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:1234/v1/models', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkClaudeStatus(): Promise<boolean> {
  // Check if ANTHROPIC_API_KEY is set
  return !!process.env.ANTHROPIC_API_KEY;
}
