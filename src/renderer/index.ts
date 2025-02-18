import type { IpcRendererEvent } from 'electron';
import { WindowRTCChannels } from '../common/channels';
import { EventManagerDTO, ForwardMessageDTO } from '../common/dto';

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
    | 'icecandidate'
    | 'iceconnectionstatechange'
    | 'icecandidateerror'
    | 'icegatheringstatechange'
    | 'negotiationneeded'
    | 'signalingstatechange'
    | 'track'
    | 'leave'
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
    ((data: EventManagerDTO) => void)[]
  > = {};

  public dispose(): void {
    for (const channel in this.listeners) {
      this.listeners[channel as EventManagerChannel].length = 0;
    }
  }

  public on(
    channel: EventManagerChannel,
    listener: (data: EventManagerDTO) => void
  ): void {
    if (!this.listeners[channel]) {
      this.listeners[channel] = [];
    }

    this.listeners[channel].push(listener);
  }

  public off(
    channel: EventManagerChannel,
    listener?: (data: EventManagerDTO) => void
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

  public emit(channel: EventManagerChannel, data: EventManagerDTO): void {
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

  private connection: RTCPeerConnection;

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
          this.emit('error', {
            sender: this.name,
            receiver: this.peer,
            payload: err,
          });
        }

        this.emit('icecandidate', {
          sender: this.name,
          receiver: this.peer,
          payload: event,
        });
      }
    };

    this.connection.oniceconnectionstatechange = (event: Event) => {
      if (
        this.connection.iceConnectionState === 'failed' ||
        this.connection.iceConnectionState === 'disconnected'
      ) {
        /* possibly reconfigure the connection in some way here */
        /* then request ICE restart */
        this.connection.restartIce();
      }
      this.emit('iceconnectionstatechange', {
        sender: this.name,
        receiver: this.peer,
        payload: event,
      });
    };

    this.connection.onicecandidateerror = (
      event: RTCPeerConnectionIceErrorEvent
    ) => {
      this.emit('icecandidateerror', {
        sender: this.name,
        receiver: this.peer,
        payload: event,
      });
    };

    this.connection.onicegatheringstatechange = (event: Event) => {
      this.emit('icegatheringstatechange', {
        sender: this.name,
        receiver: this.peer,
        payload: event,
      });
    };

    this.connection.onnegotiationneeded = (event: Event) => {
      // if (this.connection.signalingState != 'stable') return;
      this.emit('negotiationneeded', {
        sender: this.name,
        receiver: this.peer,
        payload: event,
      });
    };

    this.connection.onsignalingstatechange = (event: Event) => {
      this.emit('signalingstatechange', {
        sender: this.name,
        receiver: this.peer,
        payload: event,
      });
    };

    this.connection.ontrack = (event: RTCTrackEvent) => {
      this.emit('track', {
        sender: this.name,
        receiver: this.peer,
        payload: event,
      });
    };
  }

  public dispose(): void {
    // Remove tracks.
    const senders = this.connection.getSenders();
    for (const sender of senders) {
      if (sender.track) {
        sender.track.enabled = false;
        this.connection.removeTrack(sender);
      }
    }

    Ipc.removeListener(WindowRTCChannels.Signal, this._signalCallback);

    // Remove connection listeners.
    this.removeWebRTCListeners();

    super.dispose();

    Ipc.invoke(WindowRTCChannels.Signal, {
      channel: 'peer-left',
      sender: this.name,
      receiver: this.peer,
      payload: '',
    }).then((err: undefined | Error) => {
      if (err) {
        this.emit('error', {
          sender: this.name,
          receiver: this.peer,
          payload: err,
        });
      }

      this.emit('leave', {
        sender: this.name,
        receiver: this.peer,
        payload: undefined,
      });
    });
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
      this.emit('error', {
        sender: this.name,
        receiver: this.peer,
        payload: err,
      });
    }

    this.emit('sent-offer', {
      sender: this.name,
      receiver: this.peer,
      payload: offer,
    });
  }

  private async signalCallback(
    _event: IpcRendererEvent,
    data: ForwardMessageDTO
  ): Promise<void> {
    switch (data.channel) {
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
    // if (this.connection.signalingState === 'stable') return;

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
      this.emit('error', {
        sender: this.name,
        receiver: this.peer,
        payload: err,
      });
    }

    this.emit('received-offer', {
      sender: this.name,
      receiver: this.peer,
      payload: {
        offer,
        answer,
      },
    });
  }

  private handleAnswer(answer: SdpObject): void {
    this.connection.setRemoteDescription(answer);

    this.emit('received-answer', {
      sender: this.name,
      receiver: this.peer,
      payload: answer,
    });
  }

  private handleCandidate(candidate: RTCIceCandidate): void {
    this.connection.addIceCandidate(candidate);

    this.emit('received-candidate', {
      sender: this.name,
      receiver: this.peer,
      payload: candidate,
    });
  }

  private handleLeave() {
    this.removeWebRTCListeners();

    this.emit('peer-left', {
      sender: this.name,
      receiver: this.peer,
      payload: undefined,
    });
  }

  private removeWebRTCListeners(): void {
    this.connection.close();
    this.connection.onicecandidate = null;
    this.connection.onicecandidateerror = null;
    this.connection.oniceconnectionstatechange = null;
    this.connection.ontrack = null;
  }
}
