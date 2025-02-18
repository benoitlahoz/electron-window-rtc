<script lang="ts">
export default {
  name: 'ReceiverWindow',
};
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { WindowRTCPeerConnection, defineIpc } from '../../../../../src/renderer';
import type { EventManagerDTO } from '../../../../../src/common/dto';

defineIpc(window.electron.ipcRenderer);

let peerWindowConnection: WindowRTCPeerConnection | null = null;
const videoRef = ref<HTMLVideoElement | undefined>();
const ratio = ref(window.devicePixelRatio);

onMounted(async () => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }
  peerWindowConnection = await WindowRTCPeerConnection.with('sender');
  console.log('Window name:', peerWindowConnection.name);
  listenPeerConnection();
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
      if (peerWindowConnection) {
        const video = videoRef.value;
        if (!video) {
          throw new Error(`Video element may not be mounted yet on '${peerWindowConnection.name}'`);
        }

        const trackEvent: RTCTrackEvent = event.payload;
        const streams = trackEvent.streams;
        for (const stream of streams) {
          video.srcObject = null;
          video.srcObject = stream;
        }
      }
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
</script>

<template lang="pug">
.w-full.h-full.flex.flex-col 
  .w-full.flex(
    class="h-[34px]"
  ).titlebar
    .flex-1
    .flex-1.flex.justify-center.items-center Receiver 
    .flex-1
  .w-full.flex-1
    video(
      ref="videoRef",
      :width="400 * ratio",
      :controls="false",
      :muted="true",
      :autoplay="true",
      :plays-inline="true",
    ).h-full.relative
</template>
