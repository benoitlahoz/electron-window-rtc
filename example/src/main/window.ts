import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import { is } from '@electron-toolkit/utils';
import { WindowRTCMain } from '../../../src/main';
import icon from '../../resources/icon.png?asset';

export const createWindow = (name: string, route: string): BrowserWindow => {
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
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${route}`);
  } else {
    win.loadFile(`${join(__dirname, '../renderer/index.html')}`, { hash: route.replace('/', '') }); // TODO: Routes in production.
  }

  return win;
};
