# electron-window-rtc

<a href='https://en.wikipedia.org/wiki/Marseille'>
    <img src="assets/badges/made_with_♥_in-Marseille-cc0040.svg">
</a>

---

Inspired by [electron-peer-connection](https://github.com/han-gyeol/electron-peer-connection), `electron-window-rtc` is a zero-dependency package that allows sharing medias between [Electron](https://www.electronjs.org/) windows through [WebRTC](https://webrtc.org/) with (almost) zero-latency, depending on application configuration.

It works by creating a **main process** events hub that acts as a signaling server for the windows through Electron's IPC. Once windows are registered, each **renderer process** creates a `WindowRTCPeerConnection` to another window and begins to send/receive media streams.

This package was primarily released to handle video/canvas manipulation before sending it to a [window rendered offscreen](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering) passed to the [Syphon framework](https://github.com/Syphon/Syphon-Framework) with same author's [node-syphon](https://github.com/benoitlahoz/node-syphon) package.

### Donate

If you find this package useful, contribute to my Open-Source work by donating here! Thank you!

[![paypal](https://img.shields.io/badge/contribute-Paypal-2ea44f)](https://www.paypal.com/donate/?hosted_button_id=C2ABZ3KBUXF92)

## Table of Contents

---

- [electron-window-rtc](#electron-window-rtc)
    - [Donate](#donate)
  - [Table of Contents](#table-of-contents)
  - [Install](#install)
  - [Usage](#usage)
    - [Main process](#main-process)
    - [Renderer process](#renderer-process)
      - [Sender](#sender)
      - [Receiver](#receiver)
  - [API](#api)
    - [Main process](#main-process-1)
      - [`WindowRTCMain.register`](#windowrtcmainregister)
      - [`WindowRTCMain.unregister`](#windowrtcmainunregister)
      - [`WindowRTCMain.dispose`](#windowrtcmaindispose)
    - [Renderer process](#renderer-process-1)
      - [`defineIpc`](#defineipc)
      - [`WindowRTCPeerConnection.with`](#windowrtcpeerconnectionwith)
      - [`windowPeerConnectionInstance.addStream`](#windowpeerconnectioninstanceaddstream)
      - [`windowPeerConnectionInstance.requestOffer`](#windowpeerconnectioninstancerequestoffer)
      - [`windowPeerConnectionInstance.on`](#windowpeerconnectioninstanceon)
      - [`windowPeerConnectionInstance.off`](#windowpeerconnectioninstanceoff)
      - [`windowPeerConnectionInstance.dispose`](#windowpeerconnectioninstancedispose)
    - [Events](#events)
    - [Types](#types)
      - [`IpcObject`](#ipcobject)
      - [`WindowRTCEvent`](#windowrtcevent)
  - [Using `canvas`](#using-canvas)
    - [Setting `frameRequestRate`](#setting-framerequestrate)
    - [Without setting `frameRequestRate`](#without-setting-framerequestrate)
  - [Known Issues](#known-issues)
  - [License](#license)

## Install

---

```sh
npm i -s electron-window-rtc
```

```sh
yarn add electron-window-rtc
```

## Usage

---

See [Electron+Vue example](https://github.com/benoitlahoz/electron-window-rtc/tree/main/example) for a complete integration example.

### Main process

```typescript
// WindowRTCMain is a singleton.
import { WindowRTCMain } from 'electron-window-rtc';

const senderWindow: BrowserWindow = createWindow(); // Left to application.
const receiverWindow: BrowserWindow = createWindow();

// Note that windows can both send and receive by creating two connection (see below in 'renderer process' section).

WindowRTCMain.register('sender', senderWindow);
WindowRTCMain.register('receiver', receiverWindow);
```

### Renderer process

#### Sender

```typescript
import {
  WindowRTCPeerConnection,
  defineIpc,
} from 'electron-window-rtc/renderer';

// Important: define early how to access to IPC object, according to application 'preload' script.
// The IPC object must at least expose `on`, `removeListener`, `send` and `invoke` methods (see IPCObject below).
defineIpc(window.electron.ipcRenderer);

document.addEventListener('DOMContentLoaded', (event) => {
  const windowConnection = new WindowRTCPeerConnection('receiver');

  // Canvas for example...
  const canvas: HTMLCanvasElement = document.getElementById('canvas');

  // Add track from canvas: this will create an 'offer' for 'receiver' window.
  // Note the '240' fps framerate: leaving it empty creates latency in the receiver.
  windowConnection.addStream(canvas.captureStream(240));
});
```

#### Receiver

```typescript
import {
  WindowRTCPeerConnection,
  defineIpc,
} from 'electron-window-rtc/renderer';

// Important: define early how to access to IPC object, according to application 'preload' script.
// The IPC object must at least expose `on`, `removeListener`, `send` and `invoke` methods (see IPCObject below).
defineIpc(window.electron.ipcRenderer);

document.addEventListener('DOMContentLoaded', (event) => {
  const windowConnection = new WindowRTCPeerConnection('sender');

  // Listen to 'track' added by 'sender' window.
  windowConnection.on('track', (event: EventManagerDTO) => {
    const video: HTMLVideoElement = document.getElementById('video');

    const trackEvent: RTCTrackEvent = event.payload;
    const streams = trackEvent.streams;
    for (const stream of streams) {
      // For the sake of this example, keep only one stream, we could also get `streams[0]`.
      video.srcObject = null;
      video.srcObject = stream;
    }
  });
});
```

## API

---

### Main process

Import the singleton.

`import { WindowRTCMain } from 'electron-window-rtc';`

#### `WindowRTCMain.register`

Registers a `BrowserWindow` for message passing with a unique name.

**Parameters**

| Name     | Type            | Default     | Optional |
| -------- | --------------- | ----------- | -------- |
| `name`   | `string`        | `undefined` | false    |
| `window` | `BrowserWindow` | `undefined` | false    |

**Returns** `void`
**Throws** `Error` if a window with this name or this window has already been registered.

#### `WindowRTCMain.unregister`

Unregister a `BrowserWindow` from message passing.

**Parameters**

| Name   | Type     | Default     | Optional |
| ------ | -------- | ----------- | -------- |
| `name` | `string` | `undefined` | false    |

**Returns** `void`
**Throws** `Error` if a window with this name doesn't exist.

#### `WindowRTCMain.dispose`

Dispose the `WindowRTCMain` singleton by unregistering windows and removing `IpcMain` listeners.

**Returns** `void`

### Renderer process

`import { WindowRTCPeerConnection, defineIpc } from 'electron-window-rtc/renderer';`

#### `defineIpc`

Define the global `IpcObject` to use for thiw window for communicating with main process.

**Parameters**

| Name  | Type        | Default     | Optional |
| ----- | ----------- | ----------- | -------- |
| `ipc` | `IpcObject` | `undefined` | false    |

**Returns** `void`

#### `WindowRTCPeerConnection.with`

Create a `WindowRTCPeerConnection` with window of given name.

**Parameters**

| Name   | Type     | Default     | Optional |
| ------ | -------- | ----------- | -------- |
| `name` | `string` | `undefined` | false    |

**Returns** `Promise<WindowRTCPeerConnection>` An instance of `WindowRTCPeerConnection`.
**Throws** `Error` if `IpcObject` was not defined with `defineIpc`, or if the window with `name` was not registered, or if this window was not registered.

#### `windowPeerConnectionInstance.addStream`

Add a stream to send to connected window and create an `offer` sent to receiving window.

**Parameters**

| Name     | Type          | Default     | Optional |
| -------- | ------------- | ----------- | -------- |
| `stream` | `MediaStream` | `undefined` | false    |

**Returns** `Promise<void>`

#### `windowPeerConnectionInstance.requestOffer`

Request the peer window to send an offer.

**Returns** `Promise<void>`

#### `windowPeerConnectionInstance.on`

Register a listener to `WindowRTCPeerConnection` instance's events.

**Parameters**

| Name       | Type                              | Default     | Optional |
| ---------- | --------------------------------- | ----------- | -------- |
| `channel`  | `WindowRTCEventChannel`           | `undefined` | false    |
| `listener` | `(event: WindowRTCEvent) => void` | `undefined` | false    |

**Returns** `void`

#### `windowPeerConnectionInstance.off`

Unregister a listener or a whole channel from `WindowRTCPeerConnection` instance's events. If `listener` is left undefined, unregisters all listeners for this channel.

**Parameters**

| Name        | Type                              | Default     | Optional |
| ----------- | --------------------------------- | ----------- | -------- |
| `channel`   | `WindowRTCEventChannel`           | `undefined` | false    |
| `listener?` | `(event: WindowRTCEvent) => void` | `undefined` | true     |

**Returns** `void`

#### `windowPeerConnectionInstance.dispose`

Close the connection with the other window and remove all listeners.

**Returns** `void`

### Events

`WindowRTCEvent` (see below) sent by `WindowRTCPeerConnection` with different payloads according to the event emitted.

| Channel                    | Payload Type                                              | Emitted                                                     |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `*`                        | `any`                                                     | For each event.                                             |
| `icecandidate`             | `RTCIceCandidate`                                         | On `icecandidate` RTCPeerConnection event.                  |
| `iceconnectionstatechange` | `Event`                                                   | On `iceconnectionstatechange` RTCPeerConnection event.      |
| `icecandidateerror`        | `RTCPeerConnectionIceErrorEvent`                          | On `icecandidateerror` RTCPeerConnection event.             |
| `icegatheringstatechange`  | `Event`                                                   | On `icegatheringstatechange` RTCPeerConnection event.       |
| `negotiationneeded`        | `Event`                                                   | On `negotiationneeded` RTCPeerConnection event.             |
| `signalingstatechange`     | `Event`                                                   | On `signalingstatechange` RTCPeerConnection event.          |
| `track`                    | `RTCTrackEvent`                                           | On `track` RTCPeerConnection event.                         |
| `leave`                    | `undefined` \| `Error`                                    | When `local` window leaves.                                 |
| `peer-left`                | `undefined` \| `Error`                                    | When `remote` window leaves.                                |
| `request-offer`            | `undefined`                                               | When a window requests an offer from its peer window.       |
| `sent-offer`               | `RTCSessionDescriptionInit`                               | When a window has sent an offer.                            |
| `received-offer`           | `{ offer: SdpObject, answer: RTCSessionDescriptionInit }` | When a window has received an offer and **sent an answer**. |
| `received-answer`          | `SdpObject`                                               | When a window has received an answer.                       |
| `received-candidate`       | `RTCIceCandidate`                                         | When a window has received an ICE candidate.                |
| `error`                    | `Error`                                                   | When an error occurred in IPC communication.                |

### Types

#### `IpcObject`

Describes the IPC object used by `electron-window-rtc`

```typescript
interface IpcObject {
  on: (
    channel: string,
    callback: (event: IpcRendererEvent, ...args: any[]) => void
  ) => void;
  removeListener: (
    channel: string,
    callback: (event: IpcRendererEvent, ...args: any[]) => void
  ) => void;
  send: (channel: string, ...args: any[]) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}
```

#### `WindowRTCEvent`

Describes the generic event data sent and received by `WindowRTCPeerConnection`.

```typescript
interface WindowRTCEvent {
  /**
   * This window name the event was emitted from.
   */
  local: string;
  /**
   * Peer window name.
   */
  remote: string;
  payload: any;
}

// Example.
windowConnection.on('track', (event: WindowRTCEvent) => {
  const local: string = event.local;
  const receiveremoter: string = event.remote;
  const trackEvent: RTCTrackEvent = event.payload;
});
```

## Using `canvas`

---

When using `canvas` to get an image to send to other windows, application should set the `frameRequestRate` parameter of `canvas.captureStream` to a high framerate to avoid latency at the receiver side.

### Setting `frameRequestRate`

![alt good_performance](https://github.com/benoitlahoz/electron-window-rtc/blob/main/assets/electron-demo-240fps.jpg)

**Fig. 1:** _`const stream = canvas.captureStream(240);` in `Sender` window doesn't induce latency. Look at the result of `performance.now()` sent by the `Sender`._

### Without setting `frameRequestRate`

![alt bad_performance](https://github.com/benoitlahoz/electron-window-rtc/blob/main/assets/electron-demo.jpg)

**Fig. 2:** _Without setting `frameRequestRate`: a latency of ~30ms is induced._

## Known Issues

---

- In the Electron example provided, reloading `Sender` window takes a lot of time for `Receiver` window to reconnect, whereas the `requestOffer` method allows reconnecting quickly on `Receiver` window's reload.
- Closing and opening again windows has not been tested: it may involve some logic in the `main process` to be integrated in `WindowRTCMain`.

## License

[MIT](https://github.com/benoitlahoz/electron-window-rtc/blob/main/LICENSE)
