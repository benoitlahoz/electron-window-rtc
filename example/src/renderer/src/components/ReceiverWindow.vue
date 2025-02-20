<script lang="ts">
export default {
  name: 'ReceiverWindow',
};
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { WindowRTCPeerConnection, defineIpc } from '../../../../../src/renderer';
import type { WindowRTCEvent } from '../../../../../src/common/dto';

defineIpc(window.electron.ipcRenderer);

const ipcSend = window.electron.ipcRenderer.send;

let peerWindowConnection: WindowRTCPeerConnection | null = null;
const videoRef = ref<HTMLVideoElement | undefined>();
const ratio = ref(window.devicePixelRatio);
const loading = ref(true);

onMounted(async () => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }
  peerWindowConnection = await WindowRTCPeerConnection.with('Sender');
  console.log('Window name:', peerWindowConnection.name);
  ipcSend(
    'log',
    JSON.stringify({
      channel: 'dom-ready',
      sender: 'Receiver',
      receiver: 'Sender',
    }),
  );

  listenPeerConnection();

  await peerWindowConnection.requestOffer();

  // window.onbeforeunload = clean;
});

onBeforeUnmount(() => {
  clean();
});

const clean = () => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }
};

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
      console.log('Track was added.');
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

        video.onloadstart = () => {
          loading.value = true;
        };

        video.onloadeddata = () => {
          loading.value = false;
        };
      }

      ipcSend(
        'log',
        JSON.stringify({
          channel: 'track',
          sender: event.sender,
          receiver: event.receiver,
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
      v-show="loading === false",
      ref="videoRef",
      :width="400 * ratio",
      :controls="false",
      :muted="true",
      :autoplay="true",
      :plays-inline="true",
    ).h-full
    .h-full.w-full.flex.items-center.justify-center(
      v-show="loading === true"
    )
      .loader
</template>

<style>
.loader {
  width: 48px;
  height: 48px;
  border: 5px solid #fff;
  border-bottom-color: #ff3d00;
  border-radius: 50%;
  display: inline-block;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
