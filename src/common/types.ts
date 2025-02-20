export interface WindowRTCIpcEvent {
  channel: string;
  sender: string;
  receiver: string;
  payload: any;
}
