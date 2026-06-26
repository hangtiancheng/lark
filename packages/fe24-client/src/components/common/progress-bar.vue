<script setup lang="ts">
import { ref, computed } from 'vue'

const progress = ref(0)
const barWidth = computed(() => progress.value + '%')
let requestId = 0

const loadStart = () => {
  requestId = window.requestAnimationFrame(function fn() {
    if (progress.value < 100) {
      progress.value++
      requestId = window.requestAnimationFrame(fn)
    } else {
      progress.value = 0
      window.cancelAnimationFrame(requestId)
    }
  })
}

const loadEnd = () => {
  setTimeout(() => {
    requestId = window.requestAnimationFrame(() => {
      progress.value = 0
    })
  }, 3000)
}

defineExpose({
  loadStart,
  loadEnd,
})
</script>

<template>
  <main class="fixed top-0 h-1.25 w-dvw">
    <div ref="bar" class="bg-green bar h-1.25 w-0"></div>
  </main>
</template>

<style scoped lang="scss">
.bar {
  width: v-bind(barWidth);
}
</style>
