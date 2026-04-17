import React from 'react'
import { Tag } from 'antd'
import { ROBOT_STATE_2_TEXT_AND_TYPE } from '@/constants'
import robotSvg from '@/assets/robot.svg'

interface RobotCardProps {
  stateId: 0 | 1 | 2 | 3 | 4 | 5
  failureNum: number
  children?: React.ReactNode
}

const STATE_COLOR: Record<string, string> = {
  danger: 'red',
  success: 'green',
  warning: 'orange',
  info: 'blue',
}

const RobotCard: React.FC<RobotCardProps> = ({ stateId, failureNum, children }) => {
  const stateInfo = ROBOT_STATE_2_TEXT_AND_TYPE.get(stateId)
  const color = STATE_COLOR[stateInfo?.type || 'info'] ?? 'blue'

  return (
    <div
      className="grid h-55.5 w-83.25 items-center justify-center rounded-3xl! border-3 border-(--color-2nd) duration-1000 hover:scale-110"
      style={{ gridTemplateColumns: 'calc(100% / 3) calc(2 * (100% / 3))' }}
    >
      <div className="flex flex-col items-center justify-between">
        <Tag color={color} className="px-3 py-1 text-[15px]!">
          {stateInfo?.text}
        </Tag>
        <img src={robotSvg} alt="eva" width="70px" className="mt-4" />
        <p className="m-0 mt-4">零件故障数</p>
        <p className="m-0">{failureNum}</p>
      </div>

      <div>
        {children}
        <p style={{ color: failureNum > 50 ? '#fb2c36' : '#a1e3f9' }} className="m-0 mt-4">
          {failureNum > 50 ? '有预警 (零件故障数 > 50)' : '无预警 (零件故障数 <= 50)'}
        </p>
      </div>
    </div>
  )
}

export default RobotCard
