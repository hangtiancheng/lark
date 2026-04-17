import React, { useState } from 'react'
import { Row, Col, Card, Cascader, Form, Input, Select, Switch, Tag, Slider } from 'antd'
import { AddOne, CheckOne, CloseOne } from '@icon-park/react'
import MapContainer from '@/components/map/map-container'
import { ROBOT_STATES, ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import { fetchLocation } from '@/utils/fetch-location'
import { robotAddApi } from '@/apis'
import bus from '@/utils/bus'
import { fakerZH_CN as faker } from '@faker-js/faker'

const STATE_COLOR: Record<string, string> = {
  danger: 'red',
  success: 'green',
  warning: 'orange',
  info: 'blue',
}

const addressOptions = Array.from({
  length: faker.number.int({ min: 5, max: 10 }),
}).map(() => {
  const province = faker.location.state()
  return {
    value: province,
    label: province,
    children: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }).map(() => {
      const city = faker.location.city()
      return {
        value: city,
        label: city,
      }
    }),
  }
})

const MapMain: React.FC = () => {
  const [form] = Form.useForm()
  const [addressList, setAddressList] = useState<string[]>([])
  const [stateCounts, setStateCounts] = useState<number[]>([0, 0, 0, 0, 0, 0])
  const [minMaxAvg, setMinMaxAvg] = useState<[number, number, number]>([0, 0, 0])
  const [fixedDisabled, setFixedDisabled] = useState(true)
  const [persistent, setPersistent] = useState(false)
  const [addrLatLng, setAddrLatLng] = useState<[string, number, number]>(['', 0, 0])

  const handleStatData = (counts: number[], minMax: [number, number, number]) => {
    setStateCounts(counts)
    setMinMaxAvg(minMax)
  }

  const handleAddressChange = async (value: string[]) => {
    if (!value) return
    const address = value.join('')
    const [lat, lng] = await fetchLocation(address)
    setAddressList(value)
    setAddrLatLng([address, lat, lng])
  }

  const handleClose = () => {
    setFixedDisabled(true)
    form.resetFields()
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const data = {
        lat: addrLatLng[1],
        lng: addrLatLng[2],
        address: addrLatLng[0],
        ...values,
      }

      bus.publish('add-marker', data)

      if (persistent) {
        await robotAddApi(data)
      }
      form.resetFields()
    } catch {
      // validation failed
    }
  }

  return (
    <main>
      <Row gutter={20}>
        <Col span={18}>
          <Card className="rounded-3xl!">
            <MapContainer onStatData={handleStatData} />
          </Card>
        </Col>

        <Col span={6}>
          <Card className="truncate rounded-3xl! leading-7.5">
            <h1 className="mt-0 mb-4 text-[20px]">统计数据</h1>
            <p>机器人数量: {stateCounts[0]}</p>
            <p>闲置机器人数量: {stateCounts[1]}</p>
            <p>使用机器人数量: {stateCounts[2]}</p>
            <p>故障机器人数量: {stateCounts[3]}</p>
            <p>维修机器人数量: {stateCounts[4]}</p>
            <p>报废机器人数量: {stateCounts[5]}</p>
            <p>零件故障数最小值: {minMaxAvg[0]}</p>
            <p>零件故障数最大值: {minMaxAvg[1]}</p>
            <p>零件故障数平均值: {minMaxAvg[2]}</p>
          </Card>

          <Card
            className={`mt-5 rounded-3xl! duration-700! ${fixedDisabled ? 'hover:scale-110' : 'fixed-enabled'}`}
            title={
              <div className="flex items-center justify-between text-[20px]">
                <h1
                  onClick={() => setFixedDisabled(!fixedDisabled)}
                  className="m-0 cursor-pointer text-lg font-normal"
                >
                  {fixedDisabled ? '放大新增地图标记窗口' : '缩小新增地图标记窗口'}
                </h1>
                {!fixedDisabled && (
                  <div className="flex justify-center gap-2.5">
                    <CheckOne
                      theme="filled"
                      size={24}
                      fill="#7ed321"
                      strokeWidth={3}
                      className="cursor-pointer duration-500 hover:scale-150"
                      onClick={handleSubmit}
                    />
                    <CloseOne
                      theme="filled"
                      size={24}
                      fill="#fb2c36"
                      strokeWidth={3}
                      className="cursor-pointer duration-500 hover:scale-150"
                      onClick={handleClose}
                    />
                  </div>
                )}
              </div>
            }
          >
            {fixedDisabled ? (
              <div className="flex items-center justify-center py-4">
                <AddOne
                  theme="filled"
                  size={48}
                  fill="#b8e986"
                  strokeWidth={3}
                  className="cursor-pointer"
                  onClick={() => setFixedDisabled(false)}
                />
              </div>
            ) : (
              <div className="overflow-hidden">
                <div className="mb-4">
                  <span>是否持久化</span>
                  <Switch checked={persistent} onChange={setPersistent} className="ml-2.5" />
                </div>

                <Cascader
                  options={addressOptions}
                  value={addressList}
                  onChange={handleAddressChange}
                  className="mb-4 w-full"
                  placeholder="请选择地址"
                />

                <Form form={form} layout="vertical" initialValues={{ state: 1, failureNum: 0 }}>
                  <Form.Item
                    label="机器人名字"
                    name="name"
                    rules={[{ required: true, message: '请输入机器人名字' }]}
                  >
                    <Input placeholder="请输入机器人名字" />
                  </Form.Item>

                  <Form.Item label="机器人状态" name="state">
                    <Select
                      placeholder="请选择机器人状态"
                      options={ROBOT_STATES.slice(1).map((state, idx) => {
                        const info = ROBOT_STATE_2_TEXT_AND_TYPE.get(idx + 1)
                        const color = STATE_COLOR[info?.type || 'info'] ?? 'blue'
                        return {
                          label: <Tag color={color}>{state}</Tag>,
                          value: idx + 1,
                        }
                      })}
                    />
                  </Form.Item>

                  <Form.Item label="零件故障数" name="failureNum">
                    <Slider min={0} max={100} className="mx-5" />
                  </Form.Item>

                  <Form.Item label="管理员名字" name="admin" rules={[{ required: true }]}>
                    <Input placeholder="请输入管理员名字" />
                  </Form.Item>

                  <Form.Item label="管理员邮箱" name="email" rules={[{ required: true }]}>
                    <Input placeholder="请输入管理员邮箱" />
                  </Form.Item>
                </Form>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </main>
  )
}

export default MapMain
