<script lang="ts">
export default {
  name: 'ReceiverWindow',
};
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { WindowRTCEvent } from '../../../../../src/renderer';
import { WindowRTCPeerConnection, defineIpc } from '../../../../../src/renderer';
import { createLogger } from './logger';

defineIpc(window.electron.ipcRenderer);

const ipcSend = window.electron.ipcRenderer.send;

let peerWindowConnection: WindowRTCPeerConnection | null = null;
const videoRef = ref<HTMLVideoElement | undefined>();
const ratio = ref(window.devicePixelRatio);

// Audio Visualization.
const audioRef = ref<HTMLAudioElement | undefined>();
const canvasRef = ref<HTMLCanvasElement | undefined>();
let analyser: AnalyserNode;
let requestId = -1;

const loading = ref(true);

onMounted(async () => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }
  peerWindowConnection = await WindowRTCPeerConnection.with('Sender');

  // Generic message passing to main process for this connection.
  createLogger(peerWindowConnection);

  // Listen to track from sender window.

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
        // If multiple streams, keep only the last one.
        video.srcObject = null;

        // Create a new stream to keep only video.
        const srcStream = new MediaStream();
        const videoTracks = stream.getVideoTracks();
        srcStream.addTrack(videoTracks[0]);
        video.srcObject = srcStream;

        const audioTracks = stream.getAudioTracks();
        const audio = audioRef.value;
        if (audioTracks.length > 0 && audio) {
          if (requestId > -1) {
            cancelAnimationFrame(requestId);
            requestId = -1;
          }
          const context = new AudioContext();

          const audioStream = new MediaStream([audioTracks[0]]);
          const audioSource = context.createMediaStreamSource(audioStream);
          analyser = context.createAnalyser();
          analyser.fftSize = 2048;

          audioSource.connect(analyser);

          audio.srcObject = audioStream;
          audio.muted = true;
        }
      }

      video.onloadstart = () => {
        loading.value = true;
      };

      video.onloadeddata = () => {
        loading.value = false;
      };

      // Draw audio.

      draw();
    }

    ipcSend(
      'log',
      JSON.stringify({
        channel: 'track',
        local: event.local,
        remote: event.remote,
      }),
    );
  });

  console.log('Window name:', peerWindowConnection.name);
  ipcSend(
    'log',
    JSON.stringify({
      channel: 'dom-ready',
      local: 'Receiver',
      remote: 'Sender',
    }),
  );

  await peerWindowConnection.requestOffer();
});

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    throw new Error(`Canvas may not be mounted.`);
  }

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);

  const sliceWidth = canvas.width / bufferLength;
  let x = 0;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'white';
  ctx.beginPath();

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * (canvas.height / 2);

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();

  requestId = requestAnimationFrame(draw);
};

onBeforeUnmount(() => {
  clean();
  if (requestId > -1) {
    cancelAnimationFrame(requestId);
    requestId = -1;
  }
});

const clean = () => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
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
  .w-full.flex-1.relative
    video(
      v-show="loading === false",
      ref="videoRef",
      :width="400 * ratio",
      :controls="false",
      :muted="true",
      :autoplay="true",
      :plays-inline="true",
    ).h-full.absolute.top-0
    .absolute.top-8.pb-12
      canvas(
        v-show="loading === false",
        ref="canvasRef",
        width="400",
        height="40"
      )
      audio(
        ref="audioRef",
        :autoplay="true"
      ).invisible
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
