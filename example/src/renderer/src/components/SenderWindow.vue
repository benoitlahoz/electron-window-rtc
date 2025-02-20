<script lang="ts">
export default {
  name: 'SenderWindow',
};
</script>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { WindowRTCPeerConnection, defineIpc } from '../../../../../src/renderer';
import { createLogger } from './logger';
import SpeakerIcon from '../assets/speaker-icon.svg';

defineIpc(window.electron.ipcRenderer);

const ipcSend = window.electron.ipcRenderer.send;

let peerWindowConnection: WindowRTCPeerConnection | null = null;
const canvasRef = ref<HTMLCanvasElement | undefined>();
let requestId = -1;

const speakersEnabled = ref(false);
let context: AudioContext;
let oscillator: OscillatorNode;
const frequency = ref(110);
const bubbleRef = ref<HTMLElement | undefined>();

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
      local: 'Sender',
      remote: 'Receiver',
    }),
  );

  // Generic message passing to main process for this connection.
  createLogger(peerWindowConnection);

  const canvas = canvasRef.value;
  if (!canvas) {
    throw new Error(`Canvas may not be mounted yet on '${peerWindowConnection.name}'`);
  }

  // Position sliders bubble.
  positionBubble();

  // ---- Create and connect audio ----

  context = new AudioContext();
  const peer = context.createMediaStreamDestination();
  oscillator = context.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency.value;

  const imag = new Float32Array([0, 0, 1, 0, 1]); // sine
  const real = new Float32Array(imag.length); // cos
  const customWave = context.createPeriodicWave(real, imag);
  oscillator.setPeriodicWave(customWave);
  oscillator.connect(peer); // Will be added to final stream.
  oscillator.start(context.currentTime);

  // ---- First draw of the canvas ----

  draw(); // Important: begin to draw before capturing.

  // ---- Create the final stream ----

  const stream = new MediaStream();
  stream.addTrack(canvas.captureStream(240).getVideoTracks()[0]); // Important: if framerate in `captureStream` is left empty latency occurs.
  stream.addTrack(peer.stream.getAudioTracks()[0]);

  peerWindowConnection.addStream(stream);
});

const enableAudio = (value: boolean) => {
  speakersEnabled.value = value;

  if (context && oscillator) {
    if (speakersEnabled.value) {
      oscillator.connect(context.destination);
    } else {
      oscillator.disconnect(context.destination);
    }
  }
};

const onFrequencyChange = (event: InputEvent) => {
  const value = (event.currentTarget as any).value;
  frequency.value = value;
  oscillator.frequency.value = frequency.value;
  positionBubble();
};

const positionBubble = () => {
  const bubble = bubbleRef.value;
  if (bubble) {
    const percents = ((frequency.value - 50) * 100) / (420 - 50);
    const pos = 15 - 16 - percents * 0.6;
    bubble.style.left = `calc(${percents}% + ${pos}px)`;
  }
};

let angle = 0;
const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    throw new Error(`Canvas may not be mounted.`);
  }

  const percents = ((frequency.value - 50) * 100) / (420 - 50);
  angle = (angle + 0.1 * (percents + 5)) % 360;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';

  ctx.save();

  ctx.translate(200, 200);
  ctx.rotate((angle * Math.PI) / 180);

  ctx.beginPath();
  ctx.arc(50, 50, 40, 0, 2 * Math.PI);

  ctx.fill();

  ctx.restore();

  ctx.font = '12px Monospace';
  ctx.fillText(`performance.now(): ${performance.now().toFixed(2)}`, 16, 400 - 16);

  requestId = requestAnimationFrame(draw);
};

onBeforeUnmount(() => {
  if (peerWindowConnection) {
    peerWindowConnection.dispose();
    peerWindowConnection = null;
  }

  if (requestId > -1) {
    cancelAnimationFrame(requestId);
    requestId = -1;
  }

  context.close();
});
</script>

<template lang="pug">
.w-full.h-full.flex.flex-col 
  .w-full.flex(
    class="h-[34px]"
  ).titlebar
    .flex-1
    .flex-1.flex.justify-center.items-center Sender 
    .flex-1.flex.items-center.justify-end.pr-4
      .audio-icon.text-primary.z-10(
        v-if="speakersEnabled",
        @click="enableAudio(false)"
      )
        speaker-icon
      .audio-icon.opacity-50.z-10(
        v-else,
        @click="enableAudio(true)"
      )
        speaker-icon
  .w-full.flex-1.relative.bg-background-dark
    canvas(
      ref="canvasRef",
      width="400",
      height="400"
    ).h-full.absolute.top-0.left-0
    .absolute.top-0.p-4.w-full
      label(
        for="freq"
      ).text-sm Audio Frequency
      <!-- @vue-ignore -->
      input(
        id="freq",
        type="range",
        :min="50",
        :max="420",
        :value="frequency",
        @input="onFrequencyChange"
      ).w-full.slider
      .bubble.absolute.w-16.flex.justify-center.text-xs.rounded.px-2.py-1.bg-background-darker(
        ref="bubbleRef",
        class="top-[4.25rem]"
      ) {{ frequency }} Hz
</template>

<style>
.audio-icon {
  -webkit-app-region: no-drag;
}

.audio-icon:hover {
  opacity: 1;
  color: white;
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  height: 5px;
  outline: none;
  border-radius: 999px;
  background: hsl(var(--background));
}

.slider:hover {
  background: hsl(var(--primary));
}

.slider:hover.slider::-webkit-slider-thumb {
  background: hsl(var(--primary-dark)); /* Green background */
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none; /* Override default look */
  appearance: none;
  width: 15px; /* Set a specific slider handle width */
  height: 15px; /* Slider handle height */
  border-radius: 999px;
  background: hsl(var(--background-darker)); /* Green background */
  cursor: pointer; /* Cursor on hover */
}

.slider::-webkit-slider-thumb:hover {
  background: hsl(var(--primary)); /* Green background */
}
</style>
