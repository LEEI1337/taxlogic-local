/**
 * TaxLogic.local - Electron Main Process
 *
 * This is the main entry point for the Electron application.
 * It handles window management, IPC communication, and app lifecycle.
 */

import path from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env.local (then .env as fallback) before anything else
// In packaged apps, use app.getAppPath() as base; in dev, __dirname works
try {
  const basePaths = [
    path.join(__dirname, '..', '..'),
    path.join(__dirname, '..'),
    __dirname
  ];
  for (const base of basePaths) {
    dotenvConfig({ path: path.join(base, '.env.local') });
    dotenvConfig({ path: path.join(base, '.env') });
  }
} catch {
  // dotenv loading is optional - app works without it
}

import { app, BrowserWindow, Menu, shell, dialog } from 'electron';

import { registerIpcHandlers } from './ipcHandlers';
import { createApplicationMenu } from './menu';
import { logger } from './utils/logger';

// Set app name for Task Manager and system integration
app.setName('TaxLogic');

// Handle Squirrel Windows install/uninstall events with shortcuts
function handleSquirrelEvent(): boolean {
  if (process.platform !== 'win32') return false;

  const squirrelCommand = process.argv[1];
  if (!squirrelCommand) return false;

  const { spawn } = require('child_process') as typeof import('child_process');
  const appFolder = path.resolve(process.execPath, '..');
  const rootFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawnUpdate = (args: string[]): void => {
    try {
      spawn(updateDotExe, args, { detached: true });
    } catch {
      // Update.exe may not exist in dev
    }
  };

  switch (squirrelCommand) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Create Desktop & Start Menu shortcuts
      spawnUpdate(['--createShortcut', exeName, '--shortcut-locations', 'Desktop,StartMenu']);
      // Show a brief install notification
      if (squirrelCommand === '--squirrel-install') {
        try {
          const { dialog: installDialog } = require('electron') as typeof import('electron');
          // Use setTimeout to let the app fully initialize before showing dialog
          setTimeout(() => {
            installDialog.showMessageBox({
              type: 'info',
              title: 'TaxLogic Installation',
              message: 'TaxLogic wurde erfolgreich installiert!',
              detail: 'Verkn\u00FCpfungen wurden auf dem Desktop und im Startmen\u00FC erstellt.\n\nDie Anwendung wird jetzt gestartet.',
              buttons: ['OK']
            });
          }, 500);
        } catch {
          // Dialog may fail during install - that's OK
        }
      }
      setTimeout(app.quit, 2000);
      return true;

    case '--squirrel-uninstall':
      // Remove shortcuts
      spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      app.quit();
      return true;

    default:
      return false;
  }
}

if (handleSquirrelEvent()) {
  // Squirrel event handled - don't start the app
  // app.quit() is already called above
} else {
  // Normal startup - continue
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
  // Ignore EPIPE errors - these happen when stdout/stderr pipes break
  // (e.g., when Squirrel updater closes the parent process)
  if (error && (error as NodeJS.ErrnoException).code === 'EPIPE') {
    return;
  }

  try {
    logger.error('Uncaught exception:', error);
    dialog.showErrorBox(
      'Ein unerwarteter Fehler ist aufgetreten',
      `${error.message}\n\nDie Anwendung wird jetzt geschlossen.`
    );
  } catch {
    // If even the error dialog fails, just quit silently
  }
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
