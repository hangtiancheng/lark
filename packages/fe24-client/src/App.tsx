import React, { Suspense } from 'react'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { ToastProvider } from '@/components/toast'
import { router } from './router'

const App: React.FC = () => {
  return (
    <ToastProvider>
      <ConfigProvider locale={zhCN}>
        <Suspense
          fallback={
            <div className="flex h-screen w-screen items-center justify-center">
              <Spin size="large" />
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </ConfigProvider>
    </ToastProvider>
  )
}

export default App
