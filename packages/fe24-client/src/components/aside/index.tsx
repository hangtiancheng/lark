import React, { useCallback, useMemo } from 'react'
import { Menu } from 'antd'
import { Rice } from '@icon-park/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUserStore } from '@/stores/user'
import { useTabStore } from '@/stores/tab'
import { name2icon } from '@/utils/icons'
import type { IMenuItem } from '@/types/user'
import type { MenuProps } from 'antd'

type ItemType = Required<MenuProps>['items'][number]

const AsideMenu: React.FC = () => {
  const { menuList } = useUserStore()
  const { addTab } = useTabStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleTitleClick = () => navigate('/')

  const mapMenuToItems = useCallback(
    (list: IMenuItem[]): ItemType[] => {
      return list
        .filter((item) => item.url !== '/order/detail')
        .map((item) => {
          const IconComponent = name2icon.get(item.icon)

          if (item.children && item.children.length > 0) {
            return {
              key: item.name, // using name as key for submenu
              icon: IconComponent ? <IconComponent /> : null,
              label: item.name,
              children: mapMenuToItems(item.children),
            }
          }

          return {
            key: item.url, // using url as key for leaf nodes
            icon: IconComponent ? <IconComponent /> : null,
            label: item.name,
            onClick: () => {
              addTab(item.name, item.icon, item.url)
              navigate(item.url)
            },
          }
        })
    },
    [addTab, navigate],
  )

  const items = useMemo(() => mapMenuToItems(menuList), [menuList, mapMenuToItems])

  // Get active keys based on current route
  const selectedKeys = [location.pathname]

  // Try to find parent submenus for defaultOpenKeys
  const getOpenKeys = () => {
    const keys: string[] = []
    const findParent = (list: IMenuItem[], parentName?: string) => {
      for (const item of list) {
        if (item.url === location.pathname && parentName) {
          keys.push(parentName)
        }
        if (item.children) {
          findParent(item.children, item.name)
        }
      }
    }
    findParent(menuList)
    return keys
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white shadow-lg">
      <div
        className="flex h-16 cursor-pointer items-center justify-center gap-2.5 px-2.5"
        onClick={handleTitleClick}
      >
        <Rice theme="filled" size={48} fill="#b8e986" strokeWidth={3} />
        <h1 className="m-0 text-[20px]">机器人</h1>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={getOpenKeys()}
          items={items}
          className="border-none"
          theme="light"
        />
      </div>
    </div>
  )
}

export default AsideMenu
