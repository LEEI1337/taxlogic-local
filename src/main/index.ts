/**
 * TaxLogic.local - Electron Main Process
 *
 * Main entry point for window management, IPC communication, and app lifecycle.
 */

import path from 'path';
import { spawn } from 'child_process';

import { config as dotenvConfig } from 'dotenv';
import { app, BrowserWindow, Menu, shell, dialog } from 'electron';

import { registerIpcHandlers } from './ipcHandlers';
import { createApplicationMenu } from './menu';
import { logger } from './utils/logger';

// Load .env.local (then .env as fallback) before anything else
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
  // dotenv loading is optional
}

app.setName('TaxLogic');

const DEV_ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080'
]);

const isDevelopment = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getCspPolicy(): string {
  if (isDevelopment) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
      "img-src 'self' data: blob:"
    ].join('; ');
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isTrustedAppUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  if (parsed.protocol === 'file:') {
    return true;
  }

  if (!isDevelopment) {
    return false;
  }

  return DEV_ALLOWED_ORIGINS.has(parsed.origin);
}

function isExternalHttpUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

function handleSquirrelEvent(): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  const squirrelCommand = process.argv[1];
  if (!squirrelCommand) {
    return false;
  }

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
      spawnUpdate(['--createShortcut', exeName, '--shortcut-locations', 'Desktop,StartMenu']);
      if (squirrelCommand === '--squirrel-install') {
        try {
          setTimeout(() => {
            dialog.showMessageBox({
              type: 'info',
              title: 'TaxLogic Installation',
              message: 'TaxLogic wurde erfolgreich installiert.',
              detail: 'Verknuepfungen wurden auf dem Desktop und im Startmenue erstellt. Die Anwendung wird jetzt gestartet.',
              buttons: ['OK']
            });
          }, 500);
        } catch {
          // Dialog may fail during install
        }
      }
      setTimeout(app.quit, 2000);
      return true;

    case '--squirrel-uninstall':
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

let mainWindow: BrowserWindow | null = null;

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
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    trafficLightPosition: { x: 15, y: 15 }
  });

  // Apply runtime CSP header policy (dev/prod specific)
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    responseHeaders['Content-Security-Policy'] = [getCspPolicy()];
    callback({ responseHeaders });
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) {
      return;
    }

    mainWindow.show();
    logger.info('Main window displayed');

    if (isDevelopment) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('Main window closed');
  });

  // Block all untrusted popup targets
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedAppUrl(url)) {
      return { action: 'allow' };
    }

    if (isExternalHttpUrl(url)) {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  // Block untrusted main-frame navigation
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (isTrustedAppUrl(navigationUrl)) {
      return;
    }

    event.preventDefault();

    if (isExternalHttpUrl(navigationUrl)) {
      shell.openExternal(navigationUrl);
    }
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Render process gone', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('Window became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    logger.info('Window is responsive again');
  });
}

async function initializeApp(): Promise<void> {
  logger.info('Initializing TaxLogic.local...');
  logger.info(`Environment: ${isDevelopment ? 'development' : 'production'}`);
  logger.info(`Platform: ${process.platform}`);
  logger.info(`Electron: ${process.versions.electron}`);
  logger.info(`Node: ${process.versions.node}`);

  const menu = createApplicationMenu(isDevelopment);
  Menu.setApplicationMenu(menu);

  registerIpcHandlers();
  createWindow();
}

if (handleSquirrelEvent()) {
  // Squirrel event handled
} else {
  // Normal startup
}

app.whenReady().then(initializeApp).catch((error) => {
  logger.error('Failed to initialize app', error);
  app.quit();
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  logger.info('Application is quitting...');
});

process.on('uncaughtException', (error) => {
  if (error && (error as NodeJS.ErrnoException).code === 'EPIPE') {
    return;
  }

  try {
    logger.error('Uncaught exception', error);
    dialog.showErrorBox(
      'Ein unerwarteter Fehler ist aufgetreten',
      `${error.message}\n\nDie Anwendung wird jetzt geschlossen.`
    );
  } catch {
    // no-op
  }

  app.quit();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    if (!isTrustedAppUrl(navigationUrl)) {
      event.preventDefault();
    }
  });
});

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;
