<script lang="ts">
export default {
  name: 'ReceiverWindow',
};
</script>

<script setup lang="ts"></script>

<template lang="pug">
.w-full.h-full.flex.flex-col 
  .w-full.flex(
    class="h-[34px]"
  ).titlebar
    .flex-1
    .flex-1.flex.justify-center.items-center Receiver 
    .flex-1
  .w-full.flex-1.bg-black
</template>

<style lang="sass" scoped></style>
