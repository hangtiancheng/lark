import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import '@icon-park/react/styles/index.css'
import 'animate.css'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/es/locale/zh_CN'

createRoot(document.getElementById('root')!).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      components: {
        Layout: {
          headerBg: '#fff',
        },
        Button: {
          defaultShadow: 'none',
          primaryShadow: 'none',
          dangerShadow: 'none',
        },
        Menu: {
          subMenuItemBg: '#fff',
          itemHoverBg: 'rgba(184, 233, 134, 0.5)',
          itemSelectedBg: 'rgba(184, 233, 134, 1)',
          itemSelectedColor: '#fff',
        },
      },
      token: {
        colorPrimary: '#b3d8a8', // --color-1st
        colorSuccess: 'rgba(184, 233, 134, 1)', // --color-2nd
        colorWarning: '#fbffe4', // --color-3rd
        colorInfo: '#a3d1c6', // --color-4th
        colorBgBase: '#fff', // --color-5th
        fontFamily:
          "'Iosevka', 'Menlo', 'Cascadia Code', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      },
    }}
  >
    <App />
  </ConfigProvider>,
)
