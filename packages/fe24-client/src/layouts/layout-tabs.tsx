import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Watermark } from 'antd'
import { useUserStore } from '@/stores/user'
import 'animate.css'

interface LayoutTabsProps {
  watermarked: boolean
}

const LayoutTabs: React.FC<LayoutTabsProps> = ({ watermarked }) => {
  const { username } = useUserStore()
  const location = useLocation()

  return (
    <Watermark
      content={watermarked ? username : ''}
      font={{ fontSize: 28, fontFamily: 'PingFang SC, Microsoft YaHei' }}
      className="min-h-full"
    >
      <div
        key={location.pathname}
        className="animate__animated animate__fadeInLeft min-h-full w-full p-5"
      >
        <Outlet />
      </div>
    </Watermark>
  )
}

export default LayoutTabs
