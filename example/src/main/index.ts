import { app, shell, BrowserWindow } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import icon from '../../resources/icon.png?asset';
import { WindowRTCMain } from '../../../src/main';

// @ts-ignore Value never read.
let senderWindow: BrowserWindow;
let receiverWindow: BrowserWindow;

function createWindow(name: string, route: string): BrowserWindow {
  let win = new BrowserWindow({
    width: 400,
    height: 434,
    minWidth: 400,
    minHeight: 434,
    maxWidth: 400,
    maxHeight: 434,
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
    win.webContents.openDevTools();
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

  senderWindow = createWindow('sender', '/');
  let pos = senderWindow.getPosition();
  senderWindow.setPosition(pos[0] - 200, pos[1]);

  receiverWindow = createWindow('receiver', '/receiver');
  pos = receiverWindow.getPosition();
  receiverWindow.setPosition(pos[0] + 200, pos[1]);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      senderWindow = createWindow('sender', '/');
      let pos = senderWindow.getPosition();
      senderWindow.setPosition(pos[0] - 200, pos[1]);

      receiverWindow = createWindow('receiver', '/receiver');
      pos = receiverWindow.getPosition();
      receiverWindow.setPosition(pos[0] + 200, pos[1]);
    }
  });
});

app.on('before-quit', () => {});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
