import type { IpcRendererEvent } from 'electron';
import { WindowRTCIpcChannel } from '../common/ipc-channels';
import { WindowRTCIpcEvent } from '../common/types';

export interface IpcObject {
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

interface SdpObject {
  sdp: string;
  type: 'offer' | 'answer';
}

class WindowRTCEventEmitter {
  private listeners: Record<
    WindowRTCEventChannel | string,
    ((event: WindowRTCEvent) => void)[]
  > = {};

  public dispose(): void {
    for (const channel in this.listeners) {
      this.listeners[channel as WindowRTCEventChannel].length = 0;
    }
  }

  public on(
    channel: WindowRTCEventChannel,
    listener: (event: WindowRTCEvent) => void
  ): void {
    if (!this.listeners[channel]) {
      this.listeners[channel] = [];
    }

    this.listeners[channel].push(listener);
  }

  public off(
    channel: WindowRTCEventChannel,
    listener?: (event: WindowRTCEvent) => void
  ): void {
    if (this.listeners[channel]) {
      if (listener) {
        const index = this.listeners[channel].indexOf(listener);
        if (index >= 0) {
          this.listeners[channel].splice(index, 1);
        }
        return;
      }

      delete this.listeners[channel];
    }
  }

  protected emit(channel: WindowRTCEventChannel, event: WindowRTCEvent): void {
    if (this.listeners['*']) {
      // Emit all events.
      for (const listener of this.listeners['*']) {
        listener({
          channel,
          ...event,
        } as any);
      }
    }

    if (this.listeners[channel]) {
      for (const listener of this.listeners[channel]) {
        listener(event);
      }
    }
  }
}

type WindowRTCEventChannel = string &
  (
    | '*'
    | 'icecandidate'
    | 'iceconnectionstatechange'
    | 'icecandidateerror'
    | 'icegatheringstatechange'
    | 'negotiationneeded'
    | 'signalingstatechange'
    | 'track'
    | 'leave'
    | 'request-offer'
    | 'sent-offer'
    | 'received-offer'
    | 'received-answer'
    | 'received-candidate'
    | 'peer-left'
    | 'error'
  );

export interface WindowRTCEvent {
  local: string;
  remote: string;
  payload: any;
}

/**
 * Global IPC object.
 */
let Ipc: IpcObject;

/**
 * Defines a global IPC object.
 * @param { IpcObject } ipc The object that will allow Inter-process communication.
 */
export const defineIpc = (ipc: IpcObject): void => {
  Ipc = ipc;
};

export class WindowRTCPeerConnection extends WindowRTCEventEmitter {
  public static async with(peer: string): Promise<WindowRTCPeerConnection> {
    if (!Ipc) {
      throw new Error(
        `Ipc functions are not defined. Call 'defineIpc' method early.`
      );
    }

    const cleanPeerName = peer.trim();

    const windows = await Ipc.invoke(WindowRTCIpcChannel.GetRegisteredWindows);
    if (!windows.includes(peer)) {
      throw new Error(`Peer window with name '${peer}' was not registered.`);
    }

    const self = await Ipc.invoke(WindowRTCIpcChannel.GetOwnWindowName);
    if (!self) {
      throw new Error(
        `Unable to get own registered window name. Window may not have been properly registered.`
      );
    }

    return new WindowRTCPeerConnection(self, cleanPeerName);
  }

  public readonly connection: RTCPeerConnection;

  private _signalCallback: (
    event: IpcRendererEvent,
    ata: WindowRTCIpcEvent
  ) => void;

  private constructor(public readonly name: string, private peer: string) {
    super();

    this.connection = new RTCPeerConnection();

    this._signalCallback = this.signalCallback.bind(this);
    Ipc.on(WindowRTCIpcChannel.Signal, this._signalCallback);

    this.connection.onicecandidate = async (
      event: RTCPeerConnectionIceEvent
    ) => {
      if (event.candidate) {
        const err = await Ipc.invoke(WindowRTCIpcChannel.Signal, {
          channel: 'candidate',
          sender: this.name,
          receiver: this.peer,
          payload: JSON.stringify(event.candidate),
        });

        if (err) {
          this.dispatch('error', err);
        }

        this.dispatch('icecandidate', event);
      }
    };

    this.connection.oniceconnectionstatechange = async (event: Event) => {
      if (
        this.connection.iceConnectionState === 'failed' ||
        this.connection.iceConnectionState === 'disconnected'
      ) {
        // FIXME: Called after a long time of disconnection.
        // TODO: Possibly reconfigure the connection in some way here.
        this.connection.restartIce();
      }

      this.dispatch('iceconnectionstatechange', event);
    };

    this.connection.onicecandidateerror = (
      event: RTCPeerConnectionIceErrorEvent
    ) => {
      this.dispatch('icecandidateerror', event);
    };

    this.connection.onicegatheringstatechange = async (event: Event) => {
      this.dispatch('icegatheringstatechange', event);
    };

    this.connection.onnegotiationneeded = async (event: Event) => {
      this.dispatch('negotiationneeded', event);
    };

    this.connection.onsignalingstatechange = (event: Event) => {
      this.dispatch('signalingstatechange', event);
    };

    this.connection.ontrack = (event: RTCTrackEvent) => {
      this.dispatch('track', event);
    };
  }

  public dispose(): void {
    Ipc.invoke(WindowRTCIpcChannel.Signal, {
      channel: 'peer-left',
      sender: this.name,
      receiver: this.peer,
      payload: undefined,
    }).then((err: undefined | Error) => {
      if (err) {
        this.dispatch('error', err);
      }
    });

    this.dispatch('leave');

    // Remove tracks.
    const senders = this.connection.getSenders();
    for (const sender of senders) {
      if (sender.track) {
        sender.track.enabled = false;
        this.connection.removeTrack(sender);
      }
    }

    // Remove main process listener.
    Ipc.removeListener(WindowRTCIpcChannel.Signal, this._signalCallback);

    // Remove connection listeners.
    this.removeWebRTCListeners();

    this.connection.close();

    super.dispose();
  }

  public async addStream(stream: MediaStream): Promise<void> {
    // TODO: check addTransceiver (https://stackoverflow.com/a/60748084/1060921)
    for (const track of stream.getTracks()) {
      this.connection.addTrack(track, stream);
    }

    const offer = await this.connection.createOffer();

    this.connection.setLocalDescription(offer);
    // this.connection.setLocalDescription(off);

    const err = await Ipc.invoke(WindowRTCIpcChannel.Signal, {
      channel: 'offer',
      sender: this.name,
      receiver: this.peer,
      payload: JSON.stringify(offer),
    });

    if (err) {
      this.dispatch('error', err);
    }

    this.dispatch('sent-offer', offer);
  }

  public async requestOffer(): Promise<void> {
    const err = await Ipc.invoke(WindowRTCIpcChannel.Signal, {
      channel: 'request-offer',
      sender: this.name,
      receiver: this.peer,
    });

    if (err) {
      this.dispatch('error', err);
    }

    this.dispatch('request-offer');
  }

  private async signalCallback(
    _event: IpcRendererEvent,
    data: WindowRTCIpcEvent
  ): Promise<void> {
    switch (data.channel) {
      case 'request-offer': {
        const offer = await this.connection.createOffer();
        this.connection.setLocalDescription(offer);

        const err = await Ipc.invoke(WindowRTCIpcChannel.Signal, {
          channel: 'offer',
          sender: this.name,
          receiver: this.peer,
          payload: JSON.stringify(offer),
        });

        if (err) {
          this.dispatch('error', err);
        }

        this.emit('sent-offer', {
          local: this.name,
          remote: this.peer,
          payload: offer,
        });
        break;
      }

      case 'offer': {
        const offer = JSON.parse(data.payload);
        await this.handleOffer(offer);
        break;
      }

      case 'answer': {
        const answer = JSON.parse(data.payload);
        this.handleAnswer(answer);
        break;
      }

      case 'candidate': {
        const candidate = JSON.parse(data.payload);
        this.handleCandidate(candidate);
        break;
      }

      case 'peer-left': {
        if (data.sender === this.peer) this.handleLeave();
        break;
      }
    }
  }

  private async handleOffer(offer: SdpObject): Promise<void> {
    if (this.connection.signalingState === 'closed') {
      return;
    }

    this.connection.setRemoteDescription(offer);

    let answer = await this.connection.createAnswer();

    // Bitrate: https://stackoverflow.com/a/57674478/1060921
    // TODO: A soption.
    const arr = answer!.sdp!.split('\r\n');
    arr.forEach((str, i) => {
      if (/^a=fmtp:\d*/.test(str)) {
        arr[i] =
          str +
          ';x-google-max-bitrate=100000;x-google-min-bitrate=0;x-google-start-bitrate=60000';
      } else if (/^a=mid:(1|video)/.test(str)) {
        arr[i] += '\r\nb=AS:10000';
      }
    });
    answer = new RTCSessionDescription({
      type: 'answer',
      sdp: arr.join('\r\n'),
    });

    await this.connection.setLocalDescription(answer);

    const err = await Ipc.invoke(WindowRTCIpcChannel.Signal, {
      channel: 'answer',
      sender: this.name,
      receiver: this.peer,
      payload: JSON.stringify(this.connection.localDescription),
    });

    if (err) {
      this.dispatch('error', err);
    }

    this.dispatch('received-offer', {
      offer,
      answer,
    });
  }

  private handleAnswer(answer: SdpObject): void {
    if (
      this.connection.signalingState === 'closed' ||
      this.connection.signalingState === 'stable'
    ) {
      return;
    }

    this.connection.setRemoteDescription(answer);
    this.dispatch('received-answer', answer);
  }

  private handleCandidate(candidate: RTCIceCandidate): void {
    if (this.connection.iceConnectionState !== 'closed') {
      this.connection.addIceCandidate(candidate);
      this.dispatch('received-candidate', candidate);
    }
  }

  private handleLeave() {
    // this.connection.close();
    // this.removeWebRTCListeners();

    this.dispatch('peer-left');
  }

  private removeWebRTCListeners(): void {
    this.connection.close();
    this.connection.onicecandidate = null;
    this.connection.onicecandidateerror = null;
    this.connection.oniceconnectionstatechange = null;
    this.connection.ontrack = null;
  }

  private dispatch(channel: WindowRTCEventChannel, payload?: any): void {
    this.emit(channel, {
      local: this.name,
      remote: this.peer,
      payload,
    });
  }
}
