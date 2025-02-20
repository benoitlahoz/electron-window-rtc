export interface WindowRTCEvent {
  sender: string;
  receiver: string;
  payload: any;
}

export interface ForwardMessageDTO extends WindowRTCEvent {
  channel: string;
}
