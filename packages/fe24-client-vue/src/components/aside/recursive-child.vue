<script setup lang="ts">
import { ElSubMenu, ElMenuItem, ElIcon } from 'element-plus'
import type { IMenuItem } from '@/types/user'
import { name2icon } from '@/utils/icons'
import { useTabStore } from '@/stores/tab'
defineOptions({
  name: 'RecursiveChild',
})

defineProps<{
  item: IMenuItem
}>()

const tabStore = useTabStore()

// actions 可以直接解构, 不需要 storeToRefs
// state, getters 不可以直接解构, 需要 storeToRefs
const { addTab } = tabStore

const handleClick = (item: IMenuItem) => {
  const { name, icon, url } = item
  addTab(name, icon, url)
}

// if (import.meta.env.DEV) {
//   tabStore.$subscribe((mutation, newState) => {
//     // debugger
//   } /** callback */,)
// }
</script>

<template>
  <div class="child-container">
    <ElSubMenu v-if="item.children" :index="item.name">
      <template #title>
        <ElIcon>
          <Component :is="name2icon.get(item.icon)"></Component>
        </ElIcon>
        <span>{{ item.name }}</span>
      </template>
      <RecursiveChild
        v-for="child of item.children"
        :key="child.url"
        :item="child"
      ></RecursiveChild>
    </ElSubMenu>

    <ElMenuItem
      v-else
      :index="item.url"
      v-show="item.url !== '/order/detail'"
      @click="handleClick(item)"
      class="duration-500"
    >
      <ElIcon>
        <Component :is="name2icon.get(item.icon)"></Component>
      </ElIcon>
      <span>{{ item.name }}</span>
    </ElMenuItem>
  </div>
</template>

<style scoped lang="scss">
.child-container::-webkit-scrollbar {
  display: none !important;
}
</style>
