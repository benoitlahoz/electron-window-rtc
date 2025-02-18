export interface EventManagerDTO {
  sender: string;
  receiver: string;
  payload: any;
}

export interface ForwardMessageDTO extends EventManagerDTO {
  channel: string;
}
