import type { IMenuItem } from '@/types/user'
import { defineStore } from 'pinia'
import { ref } from 'vue'

// 省略 children 属性的 IMenuItem 类型
type ITabItem = Omit<IMenuItem, 'children'>

export const useTabStore = defineStore('tab', () => {
  const tabList = ref<ITabItem[]>([])

  const addTab = (name: string, icon: string, url: string) => {
    if (tabList.value.some((tab) => tab.url === url)) {
      return
    }
    tabList.value.push({ name, icon, url })
  }

  const findTab = (url: string) => {
    return tabList.value.findIndex((tab) => tab.url === url)
  }

  const removeTab = (idx: number) => {
    tabList.value.splice(idx, 1)
  }

  return {
    tabList,
    addTab,
    findTab,
    removeTab,
  }
})
