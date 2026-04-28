import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUserStore } from '@/stores/user'
import { useTabStore } from '@/stores/tab'
import type { IMenuItem } from '@/types/user'
import LayoutMain from './layout-main'

const LayoutWrapper = () => {
  const location = useLocation()
  const { menuList } = useUserStore()
  const { addTab } = useTabStore()

  // Find matching menu item to get tag name and icon
  let matchedItem: IMenuItem | null = null
  const findItem = (list: IMenuItem[]) => {
    for (const item of list) {
      if (item.url === location.pathname) {
        matchedItem = item
        return
      }
      if (item.children) {
        findItem(item.children)
      }
    }
  }
  findItem(menuList)

  const tagName = matchedItem ? (matchedItem as IMenuItem).name : undefined
  const tagIcon = matchedItem ? (matchedItem as IMenuItem).icon : undefined

  useEffect(() => {
    if (tagName) {
      addTab(tagName, tagIcon || '', location.pathname)
    }
  }, [location.pathname, tagName, tagIcon, addTab])

  return <LayoutMain />
}

export default LayoutWrapper
