<script lang="ts">
export default {
  name: 'SenderWindow',
};
</script>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { WindowRTCPeerConnection, defineIpc } from '../../../../../src/renderer';
import type { EventManagerDTO } from '../../../../../src/common/dto';

defineIpc(window.electron.ipcRenderer);

let peerWindowConnection: WindowRTCPeerConnection | null = null;
const canvasRef = ref<HTMLCanvasElement | undefined>();

onMounted(async () => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }
  peerWindowConnection = await WindowRTCPeerConnection.with('receiver');
  console.log('Window name:', peerWindowConnection.name);
  listenPeerConnection();

  const canvas = canvasRef.value;
  if (!canvas) {
    throw new Error(`Canvas may not be mounted yet on '${peerWindowConnection.name}'`);
  }

  draw();
  peerWindowConnection.addStream(canvas.captureStream());
});

onBeforeUnmount(() => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }
});

const listenPeerConnection = () => {
  if (peerWindowConnection) {
    peerWindowConnection.on('error', (event: EventManagerDTO) => {
      console.log('Error.', event.payload);
    });

    peerWindowConnection.on('icecandidate', (event: EventManagerDTO) => {
      console.log('Ice candidate.', event.payload);
    });

    peerWindowConnection.on('iceconnectionstatechange', (event: EventManagerDTO) => {
      console.log('Ice connection state change.', event.payload);
    });

    peerWindowConnection.on('icecandidateerror', (event: EventManagerDTO) => {
      console.log('Ice candidate error.', event.payload);
    });

    peerWindowConnection.on('icegatheringstatechange', (event: EventManagerDTO) => {
      console.log('Ice gathering state change.', event.payload);
    });

    peerWindowConnection.on('negotiationneeded', (event: EventManagerDTO) => {
      console.log('Negotiation needed.', event.payload);
    });

    peerWindowConnection.on('signalingstatechange', (event: EventManagerDTO) => {
      console.log('Signaling state change.', event.payload);
    });

    peerWindowConnection.on('track', (event: EventManagerDTO) => {
      console.error('Track should not be added in sender window.', event);
    });

    peerWindowConnection.on('sent-offer', (event: EventManagerDTO) => {
      console.log('Offer was sent.', event.payload);
    });

    peerWindowConnection.on('received-offer', (event: EventManagerDTO) => {
      console.log('Offer was received, answer was sent.', event.payload);
    });

    peerWindowConnection.on('received-answer', (event: EventManagerDTO) => {
      console.log('Answer was received.', event.payload);
    });

    peerWindowConnection.on('leave', (event: EventManagerDTO) => {
      console.log('Self leave.', event.payload);
    });

    peerWindowConnection.on('peer-left', (event: EventManagerDTO) => {
      console.log('Peer left.', event.payload);
    });
  }
};

let angle = 0;

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    throw new Error(`Canvas may not be mounted yet on '${peerWindowConnection!.name}'`);
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

  requestAnimationFrame(draw);
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
