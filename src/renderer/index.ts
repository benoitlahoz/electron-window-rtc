import type { IpcRendererEvent } from 'electron';
import { WindowRTCChannels } from '../common/channels';
import { WindowRTCEvent, ForwardMessageDTO } from '../common/dto';

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

type EventManagerChannel = string &
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

class EventManager {
  private listeners: Record<
    EventManagerChannel | string,
    ((data: WindowRTCEvent) => void)[]
  > = {};

  public dispose(): void {
    for (const channel in this.listeners) {
      this.listeners[channel as EventManagerChannel].length = 0;
    }
  }

  public on(
    channel: EventManagerChannel,
    listener: (data: WindowRTCEvent) => void
  ): void {
    if (!this.listeners[channel]) {
      this.listeners[channel] = [];
    }

    this.listeners[channel].push(listener);
  }

  public off(
    channel: EventManagerChannel,
    listener?: (data: WindowRTCEvent) => void
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

  protected emit(channel: EventManagerChannel, data: WindowRTCEvent): void {
    if (this.listeners['*']) {
      // Emit all events.
      for (const listener of this.listeners['*']) {
        listener({
          channel,
          ...data,
        } as any);
      }
    }

    if (this.listeners[channel]) {
      for (const listener of this.listeners[channel]) {
        listener(data);
      }
    }
  }
}

/**
 * Global IPC object.
 */
let Ipc: IpcObject;

/**
 * Defines a global IPC object.
 * @param { IpcObject } ipc The object that will allow Inter-process communication.
 */
export const defineIpc = (ipc: IpcObject) => {
  Ipc = ipc;
};

export class WindowRTCPeerConnection extends EventManager {
  public static async with(peer: string): Promise<WindowRTCPeerConnection> {
    if (!Ipc) {
      throw new Error(
        `Ipc functions are not defined. Call 'defineIpc' method early.`
      );
    }

    const cleanPeerName = peer.trim();

    const windows = await Ipc.invoke(WindowRTCChannels.GetRegisteredWindows);
    if (!windows.includes(peer)) {
      throw new Error(`Peer window with name '${peer}' was not registered.`);
    }

    const self = await Ipc.invoke(WindowRTCChannels.GetOwnWindowName);
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
    ata: ForwardMessageDTO
  ) => void;

  private constructor(public readonly name: string, private peer: string) {
    super();

    this.connection = new RTCPeerConnection();

    this._signalCallback = this.signalCallback.bind(this);
    Ipc.on(WindowRTCChannels.Signal, this._signalCallback);

    this.connection.onicecandidate = async (
      event: RTCPeerConnectionIceEvent
    ) => {
      if (event.candidate) {
        const err = await Ipc.invoke(WindowRTCChannels.Signal, {
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

        // possibly reconfigure the connection in some way here
        // then request ICE restart
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
    Ipc.invoke(WindowRTCChannels.Signal, {
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
    Ipc.removeListener(WindowRTCChannels.Signal, this._signalCallback);

    // Remove connection listeners.
    this.removeWebRTCListeners();

    this.connection.close();

    super.dispose();
  }

  public async addStream(stream: MediaStream): Promise<void> {
    for (const track of stream.getTracks()) {
      this.connection.addTrack(track, stream);
    }

    const offer = await this.connection.createOffer();

    this.connection.setLocalDescription(offer);

    const err = await Ipc.invoke(WindowRTCChannels.Signal, {
      channel: 'offer',
      sender: this.name,
      receiver: this.peer,
      payload: JSON.stringify(offer),
    });

    if (err) {
      this.dispatch('error', err);
    }

    this.emit('sent-offer', {
      sender: this.name,
      receiver: this.peer,
      payload: offer,
    });
  }

  public async requestOffer(): Promise<void> {
    const err = await Ipc.invoke(WindowRTCChannels.Signal, {
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
    data: ForwardMessageDTO
  ): Promise<void> {
    switch (data.channel) {
      case 'request-offer': {
        const offer = await this.connection.createOffer();
        this.connection.setLocalDescription(offer);

        const err = await Ipc.invoke(WindowRTCChannels.Signal, {
          channel: 'offer',
          sender: this.name,
          receiver: this.peer,
          payload: JSON.stringify(offer),
        });

        if (err) {
          this.dispatch('error', err);
        }

        this.emit('sent-offer', {
          sender: this.name,
          receiver: this.peer,
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

    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);

    const err = await Ipc.invoke(WindowRTCChannels.Signal, {
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

  private dispatch(channel: EventManagerChannel, payload?: any): void {
    this.emit(channel, {
      sender: this.name,
      receiver: this.peer,
      payload,
    });
  }
}
