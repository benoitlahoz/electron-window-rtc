<script lang="ts">
export default {
  name: 'SenderWindow',
};
</script>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import type { WindowRTCEvent } from '../../../../../src/renderer';
import { WindowRTCPeerConnection, defineIpc } from '../../../../../src/renderer';

defineIpc(window.electron.ipcRenderer);

const ipcSend = window.electron.ipcRenderer.send;

let peerWindowConnection: WindowRTCPeerConnection | null = null;
const canvasRef = ref<HTMLCanvasElement | undefined>();
let requestId = -1;

onMounted(async () => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }
  peerWindowConnection = await WindowRTCPeerConnection.with('Receiver');
  console.log('Window name:', peerWindowConnection.name);
  ipcSend(
    'log',
    JSON.stringify({
      channel: 'dom-ready',
      sender: 'Sender',
      receiver: 'Receiver',
    }),
  );
  listenPeerConnection();

  const canvas = canvasRef.value;
  if (!canvas) {
    throw new Error(`Canvas may not be mounted yet on '${peerWindowConnection.name}'`);
  }

  draw();
  peerWindowConnection.addStream(canvas.captureStream(240)); // Important: if framerate is left empty latency occurs.
});

onBeforeUnmount(() => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }

  if (requestId > -1) {
    cancelAnimationFrame(requestId);
    requestId = -1;
  }
});

const listenPeerConnection = () => {
  if (peerWindowConnection) {
    peerWindowConnection.on('error', (event: WindowRTCEvent) => {
      console.log('An error occurred.', event.payload);
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'error',
          sender: event.sender,
          receiver: event.receiver,
          payload: event.payload,
        }),
      );
    });

    peerWindowConnection.on('icecandidate', (event: WindowRTCEvent) => {
      console.log('Received ice candidate.');
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'icecandidate',
          sender: event.sender,
          receiver: event.receiver,
        }),
      );
    });

    peerWindowConnection.on('iceconnectionstatechange', (event: WindowRTCEvent) => {
      console.log('Ice connection state change:', event.payload.currentTarget.iceConnectionState);
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'iceconnectionstatechange',
          sender: event.sender,
          receiver: event.receiver,
          payload: event.payload.currentTarget.iceConnectionState,
        }),
      );
    });

    peerWindowConnection.on('icecandidateerror', (event: WindowRTCEvent) => {
      console.log('Ice candidate error:', event.payload.errorText);
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'icecandidateerror',
          sender: event.sender,
          receiver: event.receiver,
          payload: event.payload.errorText,
        }),
      );
    });

    peerWindowConnection.on('icegatheringstatechange', (event: WindowRTCEvent) => {
      console.log('Ice gathering state change:', event.payload.currentTarget.iceGatheringState);
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'icegatheringstatechange',
          sender: event.sender,
          receiver: event.receiver,
          payload: event.payload.currentTarget.iceGatheringState,
        }),
      );
    });

    peerWindowConnection.on('negotiationneeded', (event: WindowRTCEvent) => {
      console.log('Negotiation needed:', event.payload.currentTarget.signalingState);
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'negotiationneeded',
          sender: event.sender,
          receiver: event.receiver,
          payload: event.payload.currentTarget.signalingState,
        }),
      );
    });

    peerWindowConnection.on('signalingstatechange', (event: WindowRTCEvent) => {
      console.log('Signaling state change:', event.payload.currentTarget.signalingState);
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'signalingstatechange',
          sender: event.sender,
          receiver: event.receiver,
          payload: event.payload.currentTarget.signalingState,
        }),
      );
    });

    peerWindowConnection.on('track', (event: WindowRTCEvent) => {
      console.error('Track should not be added in sender window.', event);
      ipcSend(
        'track',
        JSON.stringify({
          channel: 'signalingstatechange',
          sender: event.sender,
          receiver: event.receiver,
          payload: new Error('Track should not be added in sender window.'),
        }),
      );
    });

    peerWindowConnection.on('request-offer', (event: WindowRTCEvent) => {
      console.log('Offer was requested.');
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'request-offer',
          sender: event.sender,
          receiver: event.receiver,
        }),
      );
    });

    peerWindowConnection.on('sent-offer', (event: WindowRTCEvent) => {
      console.log('Offer was sent.');
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'sent-offer',
          sender: event.sender,
          receiver: event.receiver,
        }),
      );
    });

    peerWindowConnection.on('received-offer', (event: WindowRTCEvent) => {
      console.log('Offer was received, answer was sent.');
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'received-offer',
          sender: event.sender,
          receiver: event.receiver,
        }),
      );
    });

    peerWindowConnection.on('received-answer', (event: WindowRTCEvent) => {
      console.log('Answer was received.');
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'received-answer',
          sender: event.sender,
          receiver: event.receiver,
        }),
      );
    });

    peerWindowConnection.on('leave', (event: WindowRTCEvent) => {
      console.log('Self leave with error', event.payload);
      ipcSend(
        'log',
        JSON.stringify({
          channel: 'leave',
          sender: event.sender,
          receiver: event.receiver,
          payload: event.payload,
        }),
      );
    });

    peerWindowConnection.on('peer-left', (event: WindowRTCEvent) => {
      console.log('Peer left with error:', event.payload);
      // peerWindowConnection!.dispose();
      // peerWindowConnection = null;

      ipcSend(
        'log',
        JSON.stringify({
          channel: 'peer-left',
          sender: event.sender,
          receiver: event.receiver,
          payload: event.payload,
        }),
      );
    });
  }
};

let angle = 0;

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    throw new Error(`Canvas may not be mounted.`);
  }

  angle = (angle + 1) % 360;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';

  ctx.save();

  ctx.translate(200, 200);
  ctx.rotate((angle * Math.PI) / 180); // Then do the actual rotation.

  ctx.beginPath();
  ctx.arc(50, 50, 40, 0, 2 * Math.PI);

  ctx.fill();

  ctx.restore();

  ctx.font = '12px Verdana';
  ctx.fillText(`${performance.now().toFixed(2)}`, 16, 400 - 16);

  requestId = requestAnimationFrame(draw);
};
</script>

<template lang="pug">
.w-full.h-full.flex.flex-col 
  .w-full.flex(
    class="h-[34px]"
  ).titlebar
    .flex-1
    .flex-1.flex.justify-center.items-center Sender 
    .flex-1
  .w-full.flex-1
    canvas(
      ref="canvasRef",
      width="400",
      height="400"
    ).h-full
</template>
