import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveAtlasDesktopResourcePaths } from './resource_paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startAtlasServer() {
  // Start the atlas server on port 8788
  const { startAtlasDesktopServer } = await import('../src/atlas/server.js');
  await startAtlasDesktopServer(8788);
}

function createWindow() {
  const resources = resolveAtlasDesktopResourcePaths();

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: resources.icon,
  });

  mainWindow.loadURL('http://localhost:8788/');

  // Open dev tools in dev
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  await startAtlasServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});