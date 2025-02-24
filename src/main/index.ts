import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { WindowRTCIpcChannel } from '../common/ipc-channels';
import { WindowRTCIpcEvent } from '../common/types';

export interface RegisteredWindow {
  name: string;
  window: BrowserWindow;
}

class _WindowRTCMain {
  /**
   * Singleton instance.
   */
  private static instance: _WindowRTCMain | null = null;

  /**
   * An `Array` of registered `BrowserWindow` with unique names.
   */
  public readonly registeredWindows: RegisteredWindow[] = [];

  constructor() {
    if (_WindowRTCMain.instance) return _WindowRTCMain.instance;

    // Handle Ipc `invoke` calls.

    ipcMain.handle(
      WindowRTCIpcChannel.GetOwnWindowName,
      this.getOwnNameCallback.bind(this)
    );

    ipcMain.handle(
      WindowRTCIpcChannel.GetRegisteredWindows,
      this.getWindowsCallback.bind(this)
    );

    ipcMain.handle(WindowRTCIpcChannel.Signal, this.signalCallback.bind(this));

    // Singleton instance.

    _WindowRTCMain.instance = this;
  }

  /**
   * Dispose the singleton.
   */
  public dispose(): void {
    ipcMain.removeHandler(WindowRTCIpcChannel.GetOwnWindowName);
    ipcMain.removeHandler(WindowRTCIpcChannel.GetRegisteredWindows);
    ipcMain.removeHandler(WindowRTCIpcChannel.Signal);
    _WindowRTCMain.instance = null;
  }

  /**
   * Register a `BrowserWindow` for message forwarding.
   *
   * @param { string } name The name the window will be registered with.
   * @param { BrowserWindow } window The window.
   */
  public register(name: string, window: BrowserWindow): void {
    const cleanName = name.trim();
    const existing = this.registeredWindows.find(
      (registered: RegisteredWindow) =>
        registered.name === cleanName || registered.window === window
    );

    if (existing) {
      throw new Error(
        `A window with name '${cleanName}' is already registered.`
      );
    }

    this.registeredWindows.push({
      name: cleanName,
      window,
    });

    window.on('close', () => {
      // Unregister and inform other windows on 'close' event.
      this.unregister(cleanName);
    });
  }

  /**
   * Unregister a `BrowserWindow` by its name.
   *
   * @param { string } name The name the window has been registered with.
   */
  public unregister(name: string): void {
    const cleanName = name.trim();
    const existing = this.registeredWindows.find(
      (registered: RegisteredWindow) => registered.name === cleanName
    );

    if (!existing) {
      return;
    }

    for (const registered of this.registeredWindows) {
      if (registered.name === cleanName) continue;

      registered.window.webContents.send(WindowRTCIpcChannel.Signal, {
        channel: 'peer-left',
        sender: cleanName,
        receiver: registered.name,
        payload: undefined,
      });
    }

    const index = this.registeredWindows.indexOf(existing);
    this.registeredWindows.splice(index, 1);
  }

  /**
   * Callback for `WindowRTCIpcChannel.GetOwnName`
   * @returns { Promise<string>} The name of the requesting window.
   */
  private async getOwnNameCallback(event: IpcMainInvokeEvent): Promise<string> {
    const existing = this.registeredWindows.find(
      (registered: RegisteredWindow) =>
        registered.window.webContents === event.sender
    );

    if (!existing) {
      throw new Error(
        `Unable to find window own name. It may not be properly registered.`
      );
    }

    return existing.name;
  }

  /**
   * Callback for `WindowRTCIpcChannel.GetWindows`
   * @returns { Promise<string[]>} The registered windows names.
   */
  private async getWindowsCallback(): Promise<string[]> {
    return this.registeredWindows.map(
      (window: RegisteredWindow) => window.name
    );
  }

  /**
   * Callback for `WindowRTCIpcChannel.Signal`
   * @returns { Promise<undefined | Error>} An `Error` if signaling message couldn't be forwarded (window was not found).
   */
  private async signalCallback(
    _event: IpcMainInvokeEvent,
    data: WindowRTCIpcEvent
  ): Promise<undefined | Error> {
    const existing = this.registeredWindows.find(
      (registered: RegisteredWindow) => registered.name === data.receiver
    );

    if (!existing) {
      return new Error(
        `Receiver window with name '${data.receiver}' could not be found.`
      );
    }

    existing.window.webContents.send(WindowRTCIpcChannel.Signal, data);
    return;
  }
}

const singleton = new _WindowRTCMain();
export { singleton as WindowRTCMain };
