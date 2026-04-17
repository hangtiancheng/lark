import React, { useState, useEffect } from 'react'
import { Card, Radio, Select } from 'antd'
import type { RadioChangeEvent } from 'antd'
import { robotQueryApi } from '@/apis'
import type { IRobotItem } from '@/types/robot'
import RobotCard from './components/robot-card'
import bus from '@/utils/bus'

const RobotGrid: React.FC = () => {
  const [robotList, setRobotList] = useState<IRobotItem[]>([])
  const [totalList, setTotalList] = useState<IRobotItem[]>([])
  const [stateId, setStateId] = useState<number>(0)
  const [checkedName, setCheckedName] = useState<string>('')

  const [stateCnt, setStateCnt] = useState<number[]>(new Array(6).fill(0))
  const [stateId2list, setStateId2list] = useState<Map<number, IRobotItem[]>>(
    new Map(Array.from({ length: 6 }).map((_, idx) => [idx, []])),
  )

  useEffect(() => {
    const fetchData = async () => {
      const dataList = (await robotQueryApi({ pageNum: 0, pageSize: -1 })).data.list
      const newCounts = new Array(6).fill(0)
      const newMap = new Map(Array.from({ length: 6 }).map((_, idx) => [idx, [] as IRobotItem[]]))

      newCounts[0] = dataList.length
      newMap.set(0, dataList)

      for (const robot of dataList) {
        newCounts[robot.state]++
        newMap.get(robot.state)!.push(robot)
      }

      setStateCnt(newCounts)
      setStateId2list(newMap)
      setTotalList(dataList)
      setRobotList(dataList)
    }

    fetchData()
  }, [])

  useEffect(() => {
    bus.publish('set-scrollTop')
    return () => {
      bus.publish('store-scrollTop')
    }
  }, [])

  const handleStateChange = (e: RadioChangeEvent) => {
    const val = e.target.value
    setStateId(val)
    setCheckedName('')
    setRobotList(stateId2list.get(val) || [])
    setTotalList(stateId2list.get(val) || [])
  }

  const handleNameChange = (val: string) => {
    setCheckedName(val)
    if (!val) {
      setRobotList(stateId2list.get(stateId) || [])
    } else {
      setRobotList((stateId2list.get(stateId) || []).filter((robot) => robot.name === val))
    }
  }

  return (
    <main>
      <Card className="rounded-3xl!">
        <div className="flex flex-col gap-5">
          <Radio.Group value={stateId} onChange={handleStateChange}>
            <Radio.Button value={0}>全部 ({stateCnt[0]})</Radio.Button>
            <Radio.Button value={1}>闲置 ({stateCnt[1]})</Radio.Button>
            <Radio.Button value={2}>使用 ({stateCnt[2]})</Radio.Button>
            <Radio.Button value={3}>故障 ({stateCnt[3]})</Radio.Button>
            <Radio.Button value={4}>维修 ({stateCnt[4]})</Radio.Button>
            <Radio.Button value={5}>报废 ({stateCnt[5]})</Radio.Button>
          </Radio.Group>

          <Select
            value={checkedName || undefined}
            onChange={handleNameChange}
            allowClear
            showSearch
            placeholder="请选择机器人名字"
            className="w-75"
            options={totalList.map((robot) => ({ label: robot.name, value: robot.name }))}
          />
        </div>
      </Card>

      <Card className="mt-5 rounded-3xl!">
        <div className="grid auto-rows-[250px] grid-cols-[repeat(auto-fill,minmax(400px,1fr))] items-center justify-items-center gap-2.5">
          {robotList.map((robot) => (
            <RobotCard
              key={robot.id}
              stateId={robot.state as 0 | 1 | 2 | 3 | 4 | 5}
              failureNum={robot.failureNum}
            >
              <div>
                <p className="m-0 truncate">机器人名字: {robot.name}</p>
                <p className="m-0 truncate">机器人地址: {robot.address}</p>
                <p className="m-0 truncate">管理员名字: {robot.admin}</p>
                <p className="m-0 truncate">管理员邮箱: {robot.email}</p>
              </div>
            </RobotCard>
          ))}
        </div>
      </Card>
    </main>
  )
}

export default RobotGrid
