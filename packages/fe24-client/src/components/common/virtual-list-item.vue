<script setup lang="ts">
import { commaSep } from '@/utils/comma-sep.ts'
import type { IRevenueItem } from '@/types/dashboard'

defineProps<{
  item: IRevenueItem
  idx: number
}>()
</script>

<template>
  <div
    class="flex h-full items-center"
    :style="{
      background: idx % 2 === 0 ? '#ecfcca' : '#fff',
    }"
  >
    <div class="w-[20%] text-center">
      {{ commaSep(item.revenue) }}
    </div>
    <div class="w-[80%] truncate">
      {{ item.address }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container::-webkit-scrollbar {
  display: none !important;
}
</style>
