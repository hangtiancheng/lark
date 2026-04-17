<script setup lang="ts">
import type { IMenuItem } from '@/types/user'
import { name2icon } from '@/utils/icons'
import { useRouter } from 'vue-router'

defineOptions({
  name: 'RecursiveChild',
})

defineProps<{
  item: IMenuItem
}>()

const router = useRouter()
const handleClick = (url: string) => {
  router.push(url)
}
</script>

<template>
  <main>
    <!-- gap: 70px -->
    <div v-if="item.children" class="flex justify-between gap-17.5">
      <RecursiveChild
        v-for="child of item.children"
        :key="child.url"
        :item="child"
      ></RecursiveChild>
    </div>

    <Component
      v-else
      :is="name2icon.get(item.icon)"
      class="text-[25px] transition-all duration-500 hover:scale-[2] hover:cursor-pointer"
      @click="handleClick(item.url)"
    ></Component>
  </main>
</template>
