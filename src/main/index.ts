import type { BrowserWindow } from 'electron';

export interface RegisteredWindow {
  name: string;
  window: BrowserWindow;
}

class _WindowMessageHub {
  /**
   * Singleton instance.
   */
  private static instance: _WindowMessageHub;

  /**
   * An `Array` of registered `BrowserWindow` with unique names.
   */
  public readonly windows: RegisteredWindow[] = [];

  constructor(private logger = console) {
    if (_WindowMessageHub.instance) return _WindowMessageHub.instance;

    _WindowMessageHub.instance = this;
  }

  /**
   * Register a `BrowserWindow` for message forwarding.
   *
   * @param { string } name The name the window will be registered with.
   * @param { BrowserWindow } window The window.
   */
  public register(name: string, window: BrowserWindow): void {
    const cleanName = name.trim();
    const existing = this.windows.find(
      (registered: RegisteredWindow) =>
        registered.name === cleanName || registered.window === window
    );

    if (existing) {
      throw new Error(`Window with name '${cleanName}' is already registered.`);
    }

    this.windows.push({
      name: cleanName,
      window,
    });
  }

  /**
   * Unregister a `BrowserWindow` by its name.
   *
   * @param { string } name The name the window has been registered with.
   */
  public unregister(name: string): void {
    const cleanName = name.trim();
    const existing = this.windows.find(
      (registered: RegisteredWindow) => registered.name === cleanName
    );

    if (!existing) {
      throw new Error(
        `Window with name '${cleanName}' was not registered and can't be unregistered.`
      );
    }

    const index = this.windows.indexOf(existing);
    this.windows.splice(index, 1);
  }
}

const singleton = new _WindowMessageHub();
export { singleton as WindowMessageHub };
