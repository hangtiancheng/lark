<script setup lang="ts">
import type { IOrderItem } from '@/types/order'
import { CloseOne } from '@icon-park/vue-next'
import { toRef, type Directive } from 'vue'
import { ORDER_STATE_2_TEXT_AND_TYPE } from '@/constants'

const props = defineProps<{
  orderData: IOrderItem
}>()

const emit = defineEmits<{
  closeWindow: []
}>()

const vDrag: Directive<HTMLElement, void> = {
  mounted(el: HTMLElement) {
    const dragEl = el.firstElementChild as HTMLDivElement
    let onMousemove: ((moveEv: MouseEvent) => void) | null = null

    const onMousedown = (downEv: MouseEvent) => {
      const dx = downEv.clientX - el.offsetLeft
      const dy = downEv.clientY - el.offsetTop
      onMousemove = (moveEv: MouseEvent) => {
        el.style.left = `${moveEv.clientX - dx}px`
        el.style.top = `${moveEv.clientY - dy}px`
      }
      document.addEventListener('mousemove', onMousemove)
      document.addEventListener('mouseup', onMouseup)
    }

    const onMouseup = () => {
      if (onMousemove) {
        document.removeEventListener('mousemove', onMousemove)
        onMousemove = null
      }
      document.removeEventListener('mouseup', onMouseup)
    }

    dragEl.addEventListener('mousedown', onMousedown)
    ;(el as any).__dragCleanup = () => {
      dragEl.removeEventListener('mousedown', onMousedown)
      if (onMousemove) {
        document.removeEventListener('mousemove', onMousemove)
      }
      document.removeEventListener('mouseup', onMouseup)
    }
  },
  unmounted(el: HTMLElement) {
    ;(el as any).__dragCleanup?.()
  },
}
const handleClose = () => {
  emit('closeWindow')
}
const orderData = toRef(props, 'orderData')
</script>

<template>
  <main>
    <div
      class="glass-container border-green fixed top-[50%] left-[50%] z-10 w-75 translate-[-50%] rounded-3xl! border-3 px-5 pb-5"
      v-drag
    >
      <!-- const dragEl = el.firstElementChild as HTMLDivElement -->
      <div class="flex cursor-pointer items-center justify-between pt-5">
        <slot name="header"></slot>
        <CloseOne
          @click="handleClose"
          theme="filled"
          size="24"
          fill="#fb2c36"
          :strokeWidth="3"
          class="cursor-pointer duration-500 hover:scale-150"
        ></CloseOne>
      </div>
      <!-- const dragEl = el.firstElementChild as HTMLDivElement -->
      <ElDivider></ElDivider>

      <ul>
        <li>
          订单状态:
          <ElTag
            :type="ORDER_STATE_2_TEXT_AND_TYPE.get(orderData.state)?.type"
            class="ml-2.5 text-[14px]!"
            size="large"
          >
            {{ ORDER_STATE_2_TEXT_AND_TYPE.get(orderData.state)?.text }}
          </ElTag>
        </li>
        <li>机器人 ID: {{ orderData.robotId }}</li>
        <li>机器人名字: {{ orderData.robotName }}</li>
      </ul>
      <ElDivider></ElDivider>
      <div class="flex justify-center text-slate-500">
        <slot name="footer"></slot>
      </div>
    </div>
  </main>
</template>

<style scoped lang="scss">
@use '../../../assets/global.scss';

.glass-container {
  @include global.glass-container(1px /** blurVal */);
}
</style>
