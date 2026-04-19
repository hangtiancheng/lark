import React from 'react'
import { Menu } from 'antd'
import { Rice } from '@icon-park/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUserStore } from '@/stores/user'
import RecursiveChild from './recursive-child'

const AsideMenu: React.FC = () => {
  const menuList = useUserStore((state) => state.menuList)
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white shadow-lg">
      <div
        className="flex h-16 cursor-pointer items-center justify-center gap-2.5 px-2.5"
        onClick={() => navigate('/')}
      >
        <Rice theme="filled" size={48} fill="#b8e986" strokeWidth={3} />
        <h1 className="m-0 text-[20px]">机器人</h1>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <Menu mode="inline" selectedKeys={[location.pathname]} className="border-none" theme="light">
          {menuList.map((item) => (
            <RecursiveChild key={item.url} item={item} />
          ))}
        </Menu>
      </div>
    </div>
  )
}

export default AsideMenu
