import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Descriptions, Divider, Tag, Image } from 'antd'
import { ListNumbers, Order, Time } from '@icon-park/react'
import type { IOrderItem } from '@/types/order'
import type { IRobotItem } from '@/types/robot'
import { orderQueryApi } from '@/apis/order'
import { robotQueryApi } from '@/apis'
import { getDate, getTime } from '@/utils'
import { ORDER_STATE_2_TEXT_AND_TYPE, ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import robotSvg from '@/assets/robot.svg'

const OrderDetail: React.FC = () => {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const robotId = searchParams.get('robotId')

  const [orderData, setOrderData] = useState<IOrderItem>({
    id: '',
    state: 1,
    robotId: 0,
    robotName: '',
    date: getDate(),
  })

  const [robotData, setRobotData] = useState<IRobotItem>({
    id: 0,
    state: 1,
    name: '',
    failureNum: 0,
    admin: '',
    email: '',
    address: '',
  })

  useEffect(() => {
    if (!orderId || !robotId) return

    const fetchData = async () => {
      try {
        const p1 = orderQueryApi({ id: orderId }).then((res) => res.data.list)
        const p2 = robotQueryApi({ id: Number.parseInt(robotId) }).then((res) => res.data.list)

        const [orderList, robotList] = await Promise.all([p1, p2])
        if (orderList && orderList.length > 0) setOrderData(orderList[0])
        if (robotList && robotList.length > 0) setRobotData(robotList[0])
      } catch (error) {
        console.error(error)
      }
    }

    fetchData()
  }, [orderId, robotId])

  const orderStateInfo = ORDER_STATE_2_TEXT_AND_TYPE.get(orderData.state)
  const orderColor =
    orderStateInfo?.type === 'success' ? 'green' : orderStateInfo?.type === 'info' ? 'blue' : 'blue'

  const robotStateInfo = ROBOT_STATE_2_TEXT_AND_TYPE.get(robotData.state)
  const robotColor =
    robotStateInfo?.type === 'danger'
      ? 'red'
      : robotStateInfo?.type === 'success'
        ? 'green'
        : robotStateInfo?.type === 'warning'
          ? 'orange'
          : 'blue'

  return (
    <main>
      <Card className="rounded-3xl!" title={<div className="text-[20px]">订单详情</div>}>
        <Card className="rounded-3xl!">
          <Descriptions title={`订单 ${orderData.id} 详情`} column={3} bordered>
            <Descriptions.Item
              label={
                <div className="flex items-center justify-center gap-2.5">
                  <ListNumbers theme="outline" size="20" fill="#7ed321" strokeWidth={3} />
                  订单号
                </div>
              }
            >
              {orderData.id}
            </Descriptions.Item>

            <Descriptions.Item
              label={
                <div className="flex items-center justify-center gap-2.5">
                  <Order theme="outline" size="20" fill="#7ed321" strokeWidth={3} />
                  订单状态
                </div>
              }
            >
              <Tag color={orderColor}>{orderStateInfo?.text}</Tag>
            </Descriptions.Item>

            <Descriptions.Item
              label={
                <div className="flex items-center justify-center gap-2.5">
                  <Time theme="outline" size="20" fill="#7ed321" strokeWidth={3} />
                  订单日期
                </div>
              }
            >
              {orderData.date}
            </Descriptions.Item>
          </Descriptions>

          <Divider dashed />

          <Descriptions title={`机器人 ${robotData.id} 详情`} column={3} bordered>
            <Descriptions.Item label="机器人 ID">{robotData.id}</Descriptions.Item>
            <Descriptions.Item label="机器人名字">{robotData.name}</Descriptions.Item>
            <Descriptions.Item label="机器人地址">{robotData.address}</Descriptions.Item>
            <Descriptions.Item label="机器人状态">
              <Tag color={robotColor}>{robotStateInfo?.text}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="零件故障数">{robotData.failureNum}</Descriptions.Item>
            <Descriptions.Item label="管理员名字">{robotData.admin}</Descriptions.Item>
            <Descriptions.Item label="管理员邮箱" span={2}>
              {robotData.email}
            </Descriptions.Item>
            <Descriptions.Item label="机器人图片" span={1}>
              <Image src={robotSvg} alt="eva" width={70} />
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <p className="mt-4 text-slate-500">{`查询时间 ${getDate()} ${getTime()}`}</p>
      </Card>
    </main>
  )
}

export default OrderDetail
