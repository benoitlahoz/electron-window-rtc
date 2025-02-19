# electron-window-rtc

Inspired by [electron-peer-connection](https://github.com/han-gyeol/electron-peer-connection), `electron-window-rtc` is a zero-dependency package that allows sharing medias between [Electron](https://www.electronjs.org/) windows through [WebRTC](https://webrtc.org/) with (almost) zero-latency, depending on application configuration.

It works by creating a **main process** events hub that acts as a signaling server for the windows through Electron's IPC. Once windows are registered, each **renderer process** creates a `WindowRTCPeerConnection` to another window and begins to send/receive media streams.

This package was primarily released to handle video/canvas manipulation before sending it to a [window rendered offscreen](https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering) passed to the [Syphon framework](https://github.com/Syphon/Syphon-Framework) with same author's [node-syphon](https://github.com/benoitlahoz/node-syphon) package.

## Install

```sh
npm i -s electron-window-rtc
```

```sh
yarn add electron-window-rtc
```

## Usage

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

// Important: define how to access to IPC object, according to application 'preload' script.
defineIpc(window.electron.ipcRenderer); // IpcObject interface: see below.

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

// Important: define how to access to IPC object, according to application 'preload' script.
defineIpc(window.electron.ipcRenderer); // IpcObject interface: see below.

document.addEventListener('DOMContentLoaded', (event) => {
  const windowConnection = new WindowRTCPeerConnection('sender');

  // Listen to 'track' added by 'sender' window.
  windowConnection.on('track', (event: EventManagerDTO) => {
    const video: HTMLVideoElement = document.getElementById('video');

    const trackEvent: RTCTrackEvent = event.payload;
    const streams = trackEvent.streams;
    for (const stream of streams) {
      // For the sake of this example, keep only one stream.
      video.srcObject = null;
      video.srcObject = stream;
    }
  });
});
```

## API

### Main process

WindowRTCMain.register(name: string, window: BrowserWindow): void
WindowRTCMain.unregister(name: string): void
WindowRTCMain.dispose(): void

### Renderer process

public static async with(peer: string): Promise<WindowRTCPeerConnection>

public dispose(): void

public async addStream(stream: MediaStream): Promise<void>

public async requestOffer(): Promise<void>

public on(
channel: EventManagerChannel,
listener: (data: EventManagerDTO) => void
): void

public off(
channel: EventManagerChannel,
listener?: (data: EventManagerDTO) => void
): void

### Events

Events sent by `WindowRTCPeerConnection` conforms to `EventManagerDTO` (see below) with different payloads according to the event emitted.

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

#### IpcObject

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

#### EventManagerDTO

Describes the generic event data sent and received by `WindowRTCPeerConnection`.

**WARNING:** interface name and property keys may change. The reason is that, for internal events, `sender` and `receiver` do not correspond to the actual event. For example, in case of `iceconnectionstatechange` event, the `sender` is actually the local peer receiving the event (self) and receiver is the remote one (`peer`) that is actually not receiving anything.

```typescript
interface EventManagerDTO {
  sender: string;
  receiver: string;
  payload: any;
}

// Example.
windowConnection.on('track', (event: EventManagerDTO) => {
  const sender: string = event.sender;
  const receiver: string = event.receiver;
  const trackEvent: RTCTrackEvent = event.payload;
});
```
