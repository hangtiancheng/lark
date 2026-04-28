<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import RecursiveChild from './recursive-child.vue'
import { ElMenu } from 'element-plus'
import { Rice } from '@icon-park/vue-next'
import { useRoute, useRouter } from 'vue-router'

const userStore = useUserStore()
const { menuList } = storeToRefs(userStore)
const route = useRoute()
const router = useRouter()
const handleClick = () => router.push({ name: 'Home' })
</script>

<template>
  <div>
    <div
      class="flex h-17.5 cursor-pointer items-center justify-center gap-2.5 px-2.5"
      @click="handleClick"
    >
      <Rice theme="filled" size="48" fill="#b8e986" :strokeWidth="3" />
      <h1 class="text-[20px]">机器人</h1>
    </div>

    <ElMenu class="menu-list border-none!" router :default-active="route.path">
      <RecursiveChild v-for="item of menuList" :key="item.url" :item="item"></RecursiveChild>
    </ElMenu>
  </div>
</template>

<style scoped lang="scss">
.menu-list {
  :deep(.is-active) {
    background-color: var(--color-green) !important;
    color: #fff;
    font-size: 16px;
    transition: all;
  }
}

:deep(.el-menu-item) {
  border-radius: 20px;
  &:hover {
    background-color: var(--color-green-light) !important;
  }
}

:deep(.el-sub-menu__title) {
  &:hover {
    background-color: var(--color-green-light) !important;
  }
}
</style>
