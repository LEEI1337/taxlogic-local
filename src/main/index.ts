/**
 * TaxLogic.local - Electron Main Process
 *
 * This is the main entry point for the Electron application.
 * It handles window management, IPC communication, and app lifecycle.
 */

import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipcHandlers';
import { createApplicationMenu } from './menu';
import { logger } from './utils/logger';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Global reference to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Create the main application window
 */
function createWindow(): void {
  logger.info('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'TaxLogic.local',
    icon: path.join(__dirname, '../../assets/icon.png'),
    backgroundColor: '#1a1b1e',
    show: false, // Don't show until ready
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Needed for some native modules
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    trafficLightPosition: { x: 15, y: 15 }
  });

  // Load the main window content
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      logger.info('Main window displayed');

      // Open DevTools in development
      if (isDevelopment) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('Main window closed');
  });

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    // Only allow navigation to our webpack dev server or local files
    if (!navigationUrl.startsWith('file://') &&
        !navigationUrl.includes('localhost')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Log render process errors
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Render process gone:', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('Window became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    logger.info('Window is responsive again');
  });
}

/**
 * Initialize the application
 */
async function initializeApp(): Promise<void> {
  logger.info('Initializing TaxLogic.local...');
  logger.info(`Environment: ${isDevelopment ? 'development' : 'production'}`);
  logger.info(`Platform: ${process.platform}`);
  logger.info(`Electron: ${process.versions.electron}`);
  logger.info(`Node: ${process.versions.node}`);

  // Set application menu
  const menu = createApplicationMenu(isDevelopment);
  Menu.setApplicationMenu(menu);

  // Register IPC handlers for frontend-backend communication
  registerIpcHandlers();

  // Create the main window
  createWindow();
}

// App lifecycle events
app.whenReady().then(initializeApp).catch((error) => {
  logger.error('Failed to initialize app:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  // On macOS, apps typically stay active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, re-create a window when dock icon is clicked and no windows exist
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  logger.info('Application is quitting...');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  dialog.showErrorBox(
    'An unexpected error occurred',
    `${error.message}\n\nThe application will now close.`
  );
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

// Security: Limit navigation and new windows
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (_navEvent, navigationUrl) => {
    // Log navigation attempts
    logger.info(`Navigation attempt to: ${navigationUrl}`);
  });
});

// Export for TypeScript declarations
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
