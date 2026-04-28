import React from 'react'
import { Menu } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTabStore } from '@/stores/tab'
import { name2icon } from '@/utils/icons'
import type { IMenuItem } from '@/types/user'

interface RecursiveChildProps {
  item: IMenuItem
}

const RecursiveChild: React.FC<RecursiveChildProps> = ({ item }) => {
  const navigate = useNavigate()
  const addTab = useTabStore((state) => state.addTab)

  if (item.url === '/order/detail') {
    return null
  }

  const IconComponent = name2icon.get(item.icon)
  const icon = IconComponent ? <IconComponent /> : null

  if (item.children?.length) {
    return (
      <Menu.SubMenu key={item.name} icon={icon} title={item.name}>
        {item.children.map((child) => (
          <RecursiveChild key={child.url} item={child} />
        ))}
      </Menu.SubMenu>
    )
  }

  return (
    <Menu.Item
      key={item.url}
      icon={icon}
      onClick={() => {
        addTab(item.name, item.icon, item.url)
        navigate(item.url)
      }}
    >
      {item.name}
    </Menu.Item>
  )
}

export default RecursiveChild
