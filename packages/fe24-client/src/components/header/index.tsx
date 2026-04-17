import React, { useState, useEffect, useRef } from 'react'
import { Badge, Dropdown, Switch, Tabs } from 'antd'
import { Remind, User, Power } from '@icon-park/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useUserStore } from '@/stores/user'
import { useTabStore } from '@/stores/tab'
import { name2icon } from '@/utils/icons'
import type { MenuProps } from 'antd'

interface HeaderMainProps {
  onSwitchWatermark: (isAlive: boolean) => void
}

export const HeaderMain: React.FC<HeaderMainProps> = ({ onSwitchWatermark }) => {
  const { username, logout } = useUserStore()
  const navigate = useNavigate()
  const [isAlive, setIsAlive] = useState(false)
  const [animated, setAnimated] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleRemindClick = () => {
    if (timerRef.current) return
    setAnimated(true)
    timerRef.current = setTimeout(() => {
      setAnimated(false)
      timerRef.current = null
    }, 1000)
  }

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout()
      navigate('/login', { replace: true })
    }
  }

  const menuProps = {
    items: [
      {
        key: 'user',
        icon: <User />,
        label: '我的账号',
      },
      {
        key: 'logout',
        icon: <Power />,
        label: '退出登录',
      },
    ],
    onClick: handleMenuClick,
  }

  return (
    <main className="mt-2.5 flex flex-col">
      <div className="flex flex-row-reverse items-center">
        <div className="mr-5 flex items-center gap-5">
          <Switch
            checked={isAlive}
            onChange={(checked) => {
              setIsAlive(checked)
              onSwitchWatermark(checked)
            }}
            checkedChildren="水印开"
            unCheckedChildren="水印关"
            style={isAlive ? { backgroundColor: '#b8e986' } : {}}
          />

          <Badge dot>
            <Remind
              theme="filled"
              size={25}
              fill="#b8e986"
              strokeWidth={3}
              onClick={handleRemindClick}
              className={`mt-1.25 cursor-pointer duration-1000 ${
                animated ? 'animate__animated animate__swing' : ''
              }`}
            />
          </Badge>

          <Dropdown menu={menuProps} placement="bottomRight">
            <span className="cursor-pointer text-lg outline-none">欢迎: {username}</span>
          </Dropdown>
        </div>
      </div>
      <HeaderTabs />
    </main>
  )
}

const HeaderTabs: React.FC = () => {
  const tabList = useTabStore((state) => state.tabList)
  const removeTab = useTabStore((state) => state.removeTab)
  const navigate = useNavigate()
  const location = useLocation()

  // Custom right click context menu can be implemented later if needed

  const onEdit = (
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove',
  ) => {
    if (action === 'remove') {
      const url = targetKey as string
      const idx = tabList.findIndex((t) => t.url === url)
      if (idx !== -1) {
        removeTab(idx)
        const newList = [...tabList]
        newList.splice(idx, 1)
        if (newList.length === 0) {
          navigate('/')
        } else if (newList.length === idx) {
          navigate(newList[idx - 1].url)
        } else {
          navigate(newList[idx].url)
        }
      }
    }
  }

  const items = tabList.map((tab) => {
    const IconComponent = name2icon.get(tab.icon)
    return {
      key: tab.url,
      label: (
        <div className="flex items-center gap-1.25">
          {IconComponent && <IconComponent />}
          <span>{tab.name}</span>
        </div>
      ),
    }
  })

  if (items.length === 0) return null

  return (
    <div className="mt-2 px-5">
      <Tabs
        hideAdd
        onChange={(key) => navigate(key)}
        activeKey={location.pathname}
        type="editable-card"
        onEdit={onEdit}
        items={items}
      />
    </div>
  )
}

export default HeaderMain
