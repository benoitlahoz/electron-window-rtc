import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { WindowRTCChannels } from '../common/channels';
import { ForwardMessageDTO } from '../common/dto';

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

  // These will receive instance corresponding methods bound to 'this'.
  private _getOwnNameCallback!: (event: IpcMainInvokeEvent) => Promise<string>;
  private _getWindowsCallback!: () => Promise<string[]>;
  private _forwardMessageCallback!: (
    event: IpcMainInvokeEvent,
    data: ForwardMessageDTO
  ) => Promise<undefined | Error>;

  constructor(private logger = console) {
    if (_WindowRTCMain.instance) return _WindowRTCMain.instance;

    // Bind callbacks.
    this._getOwnNameCallback = this.getOwnNameCallback.bind(this);
    this._getWindowsCallback = this.getWindowsCallback.bind(this);
    this._forwardMessageCallback = this.forwardMessageCallback.bind(this);

    ipcMain.handle(
      WindowRTCChannels.GetOwnWindowName,
      this._getOwnNameCallback
    );

    ipcMain.handle(
      WindowRTCChannels.GetRegisteredWindows,
      this._getWindowsCallback
    );

    ipcMain.handle(WindowRTCChannels.Signal, this._forwardMessageCallback);

    _WindowRTCMain.instance = this;
  }

  /**
   * Dispose the singleton.
   */
  public dispose(): void {
    ipcMain.removeHandler(WindowRTCChannels.GetOwnWindowName);
    ipcMain.removeHandler(WindowRTCChannels.GetRegisteredWindows);
    ipcMain.removeHandler(WindowRTCChannels.Signal);
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
      throw new Error(`Window with name '${cleanName}' is already registered.`);
    }

    this.registeredWindows.push({
      name: cleanName,
      window,
    });

    window.on('close', () => {
      for (const registered of this.registeredWindows) {
        registered.window.webContents.send(WindowRTCChannels.Signal, {
          channel: 'leave',
          sender: cleanName,
          receiver: registered.name,
          payload: undefined,
        });
      }
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
      throw new Error(
        `Window with name '${cleanName}' was not registered and can't be unregistered.`
      );
    }

    const index = this.registeredWindows.indexOf(existing);
    this.registeredWindows.splice(index, 1);
  }

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
   * Callback for `WindowRTCChannels.GetWindows`
   * @returns { Promise<string[]>} The registered windows names.
   */
  private async getWindowsCallback(): Promise<string[]> {
    return this.registeredWindows.map(
      (window: RegisteredWindow) => window.name
    );
  }

  private async forwardMessageCallback(
    _event: IpcMainInvokeEvent,
    data: ForwardMessageDTO
  ): Promise<undefined | Error> {
    const existing = this.registeredWindows.find(
      (registered: RegisteredWindow) => registered.name === data.receiver
    );

    if (!existing) {
      return new Error(
        `Receiver window with name '${data.receiver}' could not be found.`
      );
    }

    existing.window.webContents.send(WindowRTCChannels.Signal, data);
    return;
  }
}

const singleton = new _WindowRTCMain();
export { singleton as WindowRTCMain };
