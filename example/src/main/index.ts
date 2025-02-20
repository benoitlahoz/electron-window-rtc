import url from 'node:url';
import { join } from 'node:path';
import type { IpcMainEvent } from 'electron';
import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import { WindowRTCMain } from '../../../src/main';
import { createWindow } from './window';

let senderWindow: BrowserWindow;
let receiverWindow: BrowserWindow;
let consoleWindow: BrowserWindow;

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const filePath = request.url.slice('app://'.length);
    return fetch(url.pathToFileURL(join(__dirname, filePath)).toString());
  });

  // Forward logs from `Sender` and `Receiver` windows to `Console` window.
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
});

app.on('before-quit', () => {
  WindowRTCMain.dispose();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
