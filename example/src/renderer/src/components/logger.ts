import type { WindowRTCPeerConnection, WindowRTCEvent } from '../../../../../src/renderer';

const ipcSend = window.electron.ipcRenderer.send;

export const createLogger = (connection: WindowRTCPeerConnection) => {
  connection.on('error', (event: WindowRTCEvent) => {
    console.log('An error occurred.', event.payload);
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'error',
        local: event.local,
        remote: event.remote,
        payload: event.payload,
      }),
    );
  });

  connection.on('icecandidate', (event: WindowRTCEvent) => {
    console.log('Received ice candidate.');
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'icecandidate',
        local: event.local,
        remote: event.remote,
      }),
    );
  });

  connection.on('iceconnectionstatechange', (event: WindowRTCEvent) => {
    console.log('Ice connection state change:', event.payload.currentTarget.iceConnectionState);
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'iceconnectionstatechange',
        local: event.local,
        remote: event.remote,
        payload: event.payload.currentTarget.iceConnectionState,
      }),
    );
  });

  connection.on('icecandidateerror', (event: WindowRTCEvent) => {
    console.log('Ice candidate error:', event.payload.errorText);
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'icecandidateerror',
        local: event.local,
        remote: event.remote,
        payload: event.payload.errorText,
      }),
    );
  });

  connection.on('icegatheringstatechange', (event: WindowRTCEvent) => {
    console.log('Ice gathering state change:', event.payload.currentTarget.iceGatheringState);
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'icegatheringstatechange',
        local: event.local,
        remote: event.remote,
        payload: event.payload.currentTarget.iceGatheringState,
      }),
    );
  });

  connection.on('negotiationneeded', (event: WindowRTCEvent) => {
    console.log('Negotiation needed:', event.payload.currentTarget.signalingState);
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'negotiationneeded',
        local: event.local,
        remote: event.remote,
        payload: event.payload.currentTarget.signalingState,
      }),
    );
  });

  connection.on('signalingstatechange', (event: WindowRTCEvent) => {
    console.log('Signaling state change:', event.payload.currentTarget.signalingState);
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'signalingstatechange',
        local: event.local,
        remote: event.remote,
        payload: event.payload.currentTarget.signalingState,
      }),
    );
  });

  connection.on('request-offer', (event: WindowRTCEvent) => {
    console.log('Offer was requested.');
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'request-offer',
        local: event.local,
        remote: event.remote,
      }),
    );
  });

  connection.on('sent-offer', (event: WindowRTCEvent) => {
    console.log('Offer was sent.');
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'sent-offer',
        local: event.local,
        remote: event.remote,
      }),
    );
  });

  connection.on('received-offer', (event: WindowRTCEvent) => {
    console.log('Offer was received, answer was sent.');
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'received-offer',
        local: event.local,
        remote: event.remote,
      }),
    );
  });

  connection.on('received-answer', (event: WindowRTCEvent) => {
    console.log('Answer was received.');
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'received-answer',
        local: event.local,
        remote: event.remote,
      }),
    );
  });

  connection.on('leave', (event: WindowRTCEvent) => {
    console.log('Self leave with error', event.payload);
    ipcSend(
      'log',
      JSON.stringify({
        channel: 'leave',
        local: event.local,
        remote: event.remote,
        payload: event.payload,
      }),
    );
  });

  connection.on('peer-left', (event: WindowRTCEvent) => {
    console.log('Peer left with error:', event.payload);
    // connection!.dispose();
    // connection = null;

    ipcSend(
      'log',
      JSON.stringify({
        channel: 'peer-left',
        local: event.local,
        remote: event.remote,
        payload: event.payload,
      }),
    );
  });
};
