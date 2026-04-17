import React, { useState, useRef } from 'react'
import { Layout } from 'antd'
import AsideMenu from '@/components/aside'
import HeaderMain from '@/components/header'
import LayoutTabs from './layout-tabs'
import styles from './index.module.scss'

const { Header, Sider, Content } = Layout

const LayoutMain: React.FC = () => {
  const [watermarked, setWatermarked] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider width={200} theme="light" className="z-20 shadow-lg">
        <AsideMenu />
      </Sider>
      <Layout>
        <Header className={`${styles.header} z-10 flex h-[10vh] flex-col p-0`}>
          <HeaderMain onSwitchWatermark={setWatermarked} />
        </Header>
        <Content className="relative h-[90vh] overflow-auto bg-gray-50" ref={contentRef}>
          <LayoutTabs watermarked={watermarked} />
        </Content>
      </Layout>
    </Layout>
  )
}

export default LayoutMain
