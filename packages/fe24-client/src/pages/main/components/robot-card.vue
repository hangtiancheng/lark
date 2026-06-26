<script setup lang="ts">
import { ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import { toRefs } from 'vue'

const props = defineProps<{
  stateId: 0 | 1 | 2 | 3 | 4 | 5
  failureNum: number
}>()
const { stateId, failureNum } = toRefs(props)
</script>

<template>
  <div
    class="grid-layout border-2nd h-55.5 w-83.25 items-center justify-center rounded-3xl! border-3 duration-1000 hover:scale-110"
  >
    <div class="flex flex-col items-center justify-between">
      <ElTag
        size="large"
        :type="ROBOT_STATE_2_TEXT_AND_TYPE.get(stateId)?.type"
        class="text-[15px]!"
      >
        {{ ROBOT_STATE_2_TEXT_AND_TYPE.get(stateId)?.text }}
      </ElTag>
      <!-- todo: 图片懒加载 -->
      <img src="@/assets/robot.svg" alt="eva" width="70px" />
      <p>零件故障数</p>
      <p>{{ failureNum }}</p>
    </div>

    <!-- 默认插槽 -->
    <div>
      <slot name="default"></slot>
      <p :style="{ color: failureNum > 50 ? '#fb2c36' : '#a1e3f9' }">
        {{ failureNum > 50 ? '有预警 (零件故障数 > 50)' : '无预警 (零件故障数 <= 50)' }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.grid-layout {
  display: grid; // 网格布局
  // grid-template-columns: 1fr 2fr;
  grid-template-columns: calc(100% / 3) calc(2 * (100% / 3));
}
</style>
