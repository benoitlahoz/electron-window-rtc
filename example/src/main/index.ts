import type { IpcMainEvent } from 'electron';
import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { WindowRTCMain } from '../../../src/main';

let senderWindow: BrowserWindow;
let receiverWindow: BrowserWindow;
let consoleWindow: BrowserWindow;

function createWindow(name: string, route: string): BrowserWindow {
  let win = new BrowserWindow({
    width: 400,
    height: 434,
    minWidth: 400,
    minHeight: 434,
    resizable: false,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    trafficLightPosition: { x: 9, y: 10 },
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  WindowRTCMain.register(name, win);

  win.on('ready-to-show', () => {
    win.show();
    // win.webContents.openDevTools();
  });

  win.on('close', () => {
    WindowRTCMain.unregister(name);
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${route}`);
  } else {
    win.loadFile(`${join(__dirname, '../renderer/index.html')}`); // TODO: Routes in production.
  }

  return win;
}

app.whenReady().then(() => {
  process.on('SIGINT', () => {
    // Handle Ctrl+C in dev mode.
    app.quit();
  });

  process.on('SIGTERM', () => {
    // Handle '--watch' main process reload in dev mode.
    app.quit();
  });

  // Forward logs.
  ipcMain.on('log', (_event: IpcMainEvent, data: any) => {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      window.webContents.send('log', data);
    }
  });

  consoleWindow = createWindow('console', '/console');
  let pos = consoleWindow.getPosition();
  consoleWindow.setResizable(true);
  consoleWindow.setSize(800, 434, false);
  consoleWindow.setPosition(pos[0] - 200, pos[1] + 234);
  consoleWindow.setResizable(false);

  senderWindow = createWindow('Sender', '/');
  pos = senderWindow.getPosition();
  senderWindow.setPosition(pos[0] - 200, pos[1] - 200);

  receiverWindow = createWindow('Receiver', '/receiver');
  pos = receiverWindow.getPosition();
  receiverWindow.setPosition(pos[0] + 200, pos[1] - 200);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      consoleWindow = createWindow('console', '/console');
      let pos = consoleWindow.getPosition();
      consoleWindow.setResizable(true);
      consoleWindow.setSize(800, 434, false);
      consoleWindow.setPosition(pos[0] - 200, pos[1] + 234);
      consoleWindow.setResizable(false);

      senderWindow = createWindow('Sender', '/');
      pos = senderWindow.getPosition();
      senderWindow.setPosition(pos[0] - 200, pos[1] - 200);

      receiverWindow = createWindow('Receiver', '/receiver');
      pos = receiverWindow.getPosition();
      receiverWindow.setPosition(pos[0] + 200, pos[1] - 200);
    }
  });
});

app.on('before-quit', () => {});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
