const { app, BrowserWindow, dialog, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: '#1a1a2e',
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Text File...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu-open-file') },
        { label: 'Save Text As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu-save-text') },
        { type: 'separator' },
        { label: 'Import Color Mapping (JSON)...', click: () => mainWindow.webContents.send('menu-import-mapping') },
        { label: 'Export Color Mapping (JSON)', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('menu-export-mapping') },
        { type: 'separator' },
        { label: 'Export Image...', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu-export-image') },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'Alt+F4', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { type: 'separator' },
        { label: 'Toggle Full Screen', accelerator: 'F11', role: 'togglefullscreen' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Token Color Mapper', click: () => mainWindow.webContents.send('menu-about') },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC: open file
ipcMain.handle('dialog:openFile', async (_, filters) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'Text Files', extensions: ['txt', 'md', 'json'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (canceled || filePaths.length === 0) return { canceled: true };
  return { canceled: false, path: filePaths[0] };
});

// IPC: save file
ipcMain.handle('dialog:saveFile', async (_, defaultName, filters) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  return { canceled: false, path: filePath };
});

// IPC: save image (binary)
ipcMain.handle('dialog:saveImage', async (_, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'PNG Image', extensions: ['png'] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  return { canceled: false, path: filePath };
});

// IPC: show message
ipcMain.handle('dialog:message', async (_, options) => {
  return dialog.showMessageBox(mainWindow, options);
});

// IPC: get app version
ipcMain.handle('app:getVersion', () => app.getVersion());

// IPC: read file (only after user chose path via dialog)
ipcMain.handle('file:read', async (_, filePath, encoding = 'utf-8') => {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (err) {
    throw new Error(err.message);
  }
});

// IPC: write file
ipcMain.handle('file:write', async (_, filePath, data, encoding = 'utf-8') => {
  try {
    await fs.writeFile(filePath, data, encoding);
    return true;
  } catch (err) {
    throw new Error(err.message);
  }
});

// IPC: write binary (for image export)
ipcMain.handle('file:writeBuffer', async (_, filePath, buffer) => {
  try {
    await fs.writeFile(filePath, Buffer.from(buffer));
    return true;
  } catch (err) {
    throw new Error(err.message);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
