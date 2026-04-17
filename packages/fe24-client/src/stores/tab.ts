import { create } from 'zustand'
import type { IMenuItem } from '@/types/user'

type ITabItem = Omit<IMenuItem, 'children'>

interface ITabStore {
  tabList: ITabItem[]
  addTab: (name: string, icon: string, url: string) => void
  removeTab: (idx: number) => void
}

export const useTabStore = create<ITabStore>((set) => ({
  tabList: [],
  addTab: (name, icon, url) =>
    set((state) => {
      if (state.tabList.some((tab) => tab.url === url)) {
        return state
      }
      return { tabList: [...state.tabList, { name, icon, url }] }
    }),
  removeTab: (idx) =>
    set((state) => {
      const newTabList = [...state.tabList]
      newTabList.splice(idx, 1)
      return { tabList: newTabList }
    }),
}))
