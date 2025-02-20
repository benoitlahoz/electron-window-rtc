<script lang="ts">
export default {
  name: 'ConsoleWindow',
};
</script>

<script setup lang="ts">
import type { IpcRendererEvent } from 'electron';
import { nextTick, onBeforeMount, onBeforeUnmount, ref } from 'vue';

const ipcOn = window.electron.ipcRenderer.on;

const items = ref<any[]>([]);
const scrollableRef = ref<HTMLElement | undefined>();
let time;
let resetTimeout;

onBeforeMount(() => {
  ipcOn('log', (_event: IpcRendererEvent, data: any) => {
    if (resetTimeout) {
      clearTimeout(resetTimeout);
      resetTimeout = undefined;
    }
    if (typeof time === 'undefined') {
      time = 0;
    } else {
      time = performance.now() - time;
    }

    items.value.push({
      reset: time === 0,
      time: `${time.toFixed(2)} ms`,
      ...JSON.parse(data),
    });

    time = performance.now();
    // Reset the time after an amount of time (supposed inactivity).
    resetTimeout = setTimeout(() => {
      time = undefined;
      clearTimeout(resetTimeout);
      resetTimeout = undefined;
    }, 500);

    nextTick(() => {
      const scrollable = scrollableRef.value;
      if (scrollable) {
        scrollable.scrollTo(0, scrollable.scrollHeight);
      }
    });
  });
});

onBeforeUnmount(() => {
  // time = undefined;
});
</script>

<template lang="pug">
.w-full.h-full.flex.flex-col.overflow-hidden 
  .w-full.flex(
    class="h-[34px] min-h-[34px]"
  ).titlebar
    .flex-1
    .flex-1.flex.justify-center.items-center Console 
    .flex-1
  .w-full.flex.flex-1.bg-background-dark.pb-2(
    class="top-[34px]"
  )
    .w-full.flex-1.flex.flex-col.overflow-clip(
      class="h-[400px]"
    )
      table.w-full.table-fixed
        thead.text-left.text-sm.bg-background-darker.sticky.top-0.h-8
          tr
            th.pl-4 Local 
            th Event
            th Remote
            th Payload
            th(
              class="w-[100px]"
            ).pr-4 Time
      .flex-1.overflow-y-scroll.pb-2(
        ref="scrollableRef"
      )
        table.w-full.table-fixed
          tbody.text-xs 
            tr(
              v-for="{ reset, time, channel, local, remote, payload } in items",
              :class="{ 'text-primary': local === 'Receiver', 'bg-background': reset === true }"
            )
              td.pl-4.font-bold {{ local }}
              td {{ channel }}
              td {{ remote }}
              td {{ payload }}
              td(
               class="w-[100px]"
              ).pr-4 {{ time }}
</template>

<style>
tbody td {
  padding: 0.25rem;
}
</style>
