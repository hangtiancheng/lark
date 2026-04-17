import React, { useEffect, useState, useRef } from 'react'
import { Card, Col, Row, Timeline } from 'antd'
import { Refresh } from '@icon-park/react'
import { useUserStore } from '@/stores/user'
import { useChart } from '@/hooks/use-chart'
import getChartOption from './chart-option'
import getChartOption2 from './chart-option2'
import getChartOption3 from './chart-option3'
import { revenueListApi } from '@/apis/dashboard'
import type { IRevenueItem, ITimeLineItem } from '@/types/dashboard'
import VirtualList from '@/components/common/virtual-list-v2'
import type { VirtualListV2Ref } from '@/components/common/virtual-list-v2'
import bus from '@/utils/bus'
import { name2icon } from '@/utils/icons'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/toast'
import type { IMenuItem } from '@/types/user'
// import VirtualList from '@/components/common/virtual-list' // Will be implemented later

const RecursiveChild: React.FC<{ item: IMenuItem }> = ({ item }) => {
  const navigate = useNavigate()

  if (item.children) {
    return (
      <>
        {item.children.map((child) => (
          <RecursiveChild key={child.url} item={child} />
        ))}
      </>
    )
  }

  const IconComponent = name2icon.get(item.icon)
  if (!IconComponent) return null

  return (
    <div
      className="text-[25px] transition-all duration-500 hover:scale-[2] hover:cursor-pointer"
      onClick={() => navigate(item.url)}
    >
      <IconComponent />
    </div>
  )
}

const DashboardMain: React.FC = () => {
  const { menuList } = useUserStore()
  const toast = useToast()

  const virtualListRef = useRef<VirtualListV2Ref>(null)
  const [timelineList, setTimelineList] = useState<ITimeLineItem[]>([])
  const [revenueList, setRevenueList] = useState<IRevenueItem[]>([])

  const { chartRef, updateChart } = useChart(getChartOption)
  const { chartRef: chartRef2, updateChart: updateChart2 } = useChart(getChartOption2)
  const { chartRef: chartRef3, updateChart: updateChart3 } = useChart(getChartOption3)

  const [animated, setAnimated] = useState(false)
  const [animatedIdx, setAnimatedIdx] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchRevenueList = async () => {
      const res = await revenueListApi()
      setRevenueList(res.data)
    }
    fetchRevenueList()

    const handleHttpResponse = (item: ITimeLineItem) => {
      setTimelineList((prev) => [item, ...prev])
    }
    bus.subscribe('http-response', handleHttpResponse)

    return () => {
      // bus.unsubscribe('http-response', handleHttpResponse)
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const handleClick = (idx: 0 | 1 | 2, callbacks: (() => void | Promise<void>)[]) => {
    if (timerRef.current) {
      return
    }

    toast.default('请等待')

    setAnimated(true)
    setAnimatedIdx(idx)
    timerRef.current = setTimeout(() => {
      setAnimated(false)
      timerRef.current = null
      callbacks.forEach((cb) => cb())
    }, 2000)
  }

  const formatter = (timestamp: number) => {
    const date = new Date(timestamp)
    const hh = date.getHours().toString().padStart(2, '0')
    const mm = date.getMinutes().toString().padStart(2, '0')
    const ss = date.getSeconds().toString().padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }

  return (
    <main>
      <Row gutter={20}>
        <Col span={18}>
          <Card className="h-37.5 rounded-3xl!">
            <div className="flex justify-between">
              <h1 className="m-0 text-[20px]">快捷方式</h1>
            </div>
            <div className="flex h-20 items-center justify-around">
              {menuList.map((item) => (
                <RecursiveChild key={item.name} item={item} />
              ))}
            </div>
          </Card>

          <Card className="mt-5 h-125 rounded-3xl!">
            <div className="flex justify-between">
              <div className="flex items-center gap-2.5">
                <h1 className="m-0 text-[20px]">机器人统计</h1>
                <Refresh
                  theme="outline"
                  size="24"
                  fill="#333"
                  strokeWidth={3}
                  className={`cursor-pointer ${animated && animatedIdx === 0 ? 'rotate-x' : ''}`}
                  onClick={() => handleClick(0, [updateChart, updateChart2])}
                />
              </div>
            </div>
            <Row>
              <Col span={8}>
                <div className="h-100 w-full" ref={chartRef}></div>
              </Col>
              <Col span={16}>
                <div className="h-100 w-full" ref={chartRef2}></div>
              </Col>
            </Row>
          </Card>

          <Card className="mt-5 rounded-3xl!">
            <div className="flex justify-between">
              <div className="flex items-center gap-2.5">
                <h1 className="m-0 text-[20px]">营收排行榜, 数据量 {revenueList.length}</h1>
                <Refresh
                  theme="outline"
                  size="24"
                  fill="#333"
                  strokeWidth={3}
                  className={`cursor-pointer ${animated && animatedIdx === 2 ? 'rotate-x' : ''}`}
                  onClick={() => handleClick(2, [() => virtualListRef.current?.updateLargeList()])}
                />
              </div>
            </div>
            <div className="mt-4">
              <div className="h-100">
                <VirtualList
                  itemHeight={50}
                  height={400}
                  fetchLargeList={async () => {
                    const res = await revenueListApi()
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (res.data as any).list || res.data || []
                  }}
                  ref={virtualListRef}
                />
              </div>
            </div>
          </Card>
        </Col>

        <Col span={6}>
          <Card className="h-92.5 rounded-3xl!">
            <div className="flex justify-between">
              <div className="flex items-center gap-2.5">
                <h1 className="m-0 text-[20px]">机器人五边形数据</h1>
                <Refresh
                  theme="outline"
                  size="24"
                  fill="#333"
                  strokeWidth={3}
                  className={`cursor-pointer ${animated && animatedIdx === 1 ? 'rotate-x' : ''}`}
                  onClick={() => handleClick(1, [updateChart3])}
                />
              </div>
            </div>
            <div className="h-60 w-full" ref={chartRef3}></div>
          </Card>

          <Card
            className="mt-5 h-120 rounded-3xl!"
            styles={{ body: { height: '100%', overflow: 'hidden', padding: '24px 24px 0' } }}
          >
            <div className="h-full overflow-y-auto pr-4 pb-4">
              <Timeline
                items={timelineList.map((item, idx) => ({
                  color: idx === 0 ? 'green' : 'blue',
                  content: (
                    <Card className="mb-2 rounded-xl! shadow-sm" size="small">
                      <p className="m-0 mb-1 text-gray-500">{formatter(item.timestamp)}</p>
                      <p className="m-0">{item.message}</p>
                    </Card>
                  ),
                }))}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </main>
  )
}

export default DashboardMain
