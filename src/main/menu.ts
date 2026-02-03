/**
 * TaxLogic.local - Application Menu
 *
 * Defines the application menu for different platforms.
 */

import { Menu, shell, app, BrowserWindow, MenuItemConstructorOptions } from 'electron';

/**
 * Create the application menu
 */
export function createApplicationMenu(isDevelopment: boolean): Menu {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    // App Menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Einstellungen...',
                accelerator: 'Cmd+,',
                click: () => {
                  const win = BrowserWindow.getFocusedWindow();
                  if (win) {
                    win.webContents.send('menu:openSettings');
                  }
                }
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),

    // File Menu
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Neue Steuererklarung',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:newFiling');
            }
          }
        },
        {
          label: 'Steuererklarung offnen...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:openFiling');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Speichern',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:save');
            }
          }
        },
        {
          label: 'Speichern unter...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:saveAs');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Dokumente importieren...',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:importDocuments');
            }
          }
        },
        {
          label: 'Formulare exportieren...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:exportForms');
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },

    // Edit Menu
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo' as const, label: 'Ruckgangig' },
        { role: 'redo' as const, label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut' as const, label: 'Ausschneiden' },
        { role: 'copy' as const, label: 'Kopieren' },
        { role: 'paste' as const, label: 'Einfugen' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const, label: 'Einsetzen und Stil anpassen' },
              { role: 'delete' as const, label: 'Loschen' },
              { role: 'selectAll' as const, label: 'Alles auswahlen' }
            ]
          : [
              { role: 'delete' as const, label: 'Loschen' },
              { type: 'separator' as const },
              { role: 'selectAll' as const, label: 'Alles auswahlen' }
            ])
      ]
    },

    // View Menu
    {
      label: 'Ansicht',
      submenu: [
        { role: 'resetZoom' as const, label: 'Standardgrosse' },
        { role: 'zoomIn' as const, label: 'Vergrossern' },
        { role: 'zoomOut' as const, label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen' as const, label: 'Vollbild' },
        ...(isDevelopment
          ? [
              { type: 'separator' as const },
              { role: 'reload' as const, label: 'Neu laden' },
              { role: 'forceReload' as const, label: 'Erzwinge Neu laden' },
              { role: 'toggleDevTools' as const, label: 'Entwicklertools' }
            ]
          : [])
      ]
    },

    // Tax Menu (app-specific)
    {
      label: 'Steuer',
      submenu: [
        {
          label: 'Interview starten',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:startInterview');
            }
          }
        },
        {
          label: 'Dokumente verwalten',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:manageDocuments');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Analyse durchfuhren',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:runAnalysis');
            }
          }
        },
        {
          label: 'Formulare generieren',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:generateForms');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Schritt-fur-Schritt Anleitung',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:showGuide');
            }
          }
        }
      ]
    },

    // Window Menu
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize' as const, label: 'Minimieren' },
        { role: 'zoom' as const, label: 'Zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const, label: 'Alle nach vorne bringen' }
            ]
          : [{ role: 'close' as const, label: 'Schliessen' }])
      ]
    },

    // Help Menu
    {
      role: 'help' as const,
      label: 'Hilfe',
      submenu: [
        {
          label: 'Dokumentation',
          click: async () => {
            await shell.openExternal('https://github.com/taxlogic/taxlogic-local/wiki');
          }
        },
        {
          label: 'FinanzOnline Portal',
          click: async () => {
            await shell.openExternal('https://finanzonline.bmf.gv.at/');
          }
        },
        { type: 'separator' },
        {
          label: 'LLM-Status prufen',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:checkLLMStatus');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Problem melden...',
          click: async () => {
            await shell.openExternal('https://github.com/taxlogic/taxlogic-local/issues/new');
          }
        },
        {
          label: 'Uber TaxLogic.local',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.send('menu:showAbout');
            }
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}
