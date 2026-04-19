import React, { useEffect, useRef } from 'react'
import { Button, Divider, Tag } from 'antd'
import { CloseOne } from '@icon-park/react'
import { ORDER_STATE_2_TEXT_AND_TYPE } from '@/constants'
import type { IOrderItem } from '@/types/order'

interface DraggableWindowProps {
  orderData: IOrderItem
  onCloseWindow: () => void
  header?: React.ReactNode
  footer?: React.ReactNode
}

const getTagColor = (type?: string) => {
  if (type === 'success') {
    return 'green'
  }
  if (type === 'warning') {
    return 'orange'
  }
  if (type === 'danger') {
    return 'red'
  }
  return 'blue'
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
  orderData,
  onCloseWindow,
  header,
  footer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const dragHandle = container?.firstElementChild

    if (!(container instanceof HTMLDivElement) || !(dragHandle instanceof HTMLDivElement)) {
      return
    }

    const onMouseDown = (downEvent: MouseEvent) => {
      const dx = downEvent.clientX - container.offsetLeft
      const dy = downEvent.clientY - container.offsetTop

      const onMouseMove = (moveEvent: MouseEvent) => {
        container.style.left = `${moveEvent.clientX - dx}px`
        container.style.top = `${moveEvent.clientY - dy}px`
      }

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    dragHandle.addEventListener('mousedown', onMouseDown)
    return () => {
      dragHandle.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  const orderState = ORDER_STATE_2_TEXT_AND_TYPE.get(orderData.state)

  return (
    <div
      ref={containerRef}
      className="glass-container border-green fixed top-1/2 left-1/2 z-10 w-75 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-[3px] px-5 pb-5"
    >
      <div className="flex cursor-pointer items-center justify-between pt-5">
        <div>{header}</div>
        <CloseOne
          onClick={onCloseWindow}
          theme="filled"
          size={24}
          fill="#fb2c36"
          strokeWidth={3}
          className="cursor-pointer duration-500 hover:scale-150"
        />
      </div>

      <Divider />

      <ul className="space-y-3">
        <li>
          订单状态:
          <Tag color={getTagColor(orderState?.type)} className="ml-2.5">
            {orderState?.text}
          </Tag>
        </li>
        <li>机器人 ID: {orderData.robotId}</li>
        <li>机器人名字: {orderData.robotName}</li>
      </ul>

      <Divider />

      <div className="flex justify-center text-slate-500">
        {footer ?? <Button onClick={onCloseWindow}>关闭</Button>}
      </div>
    </div>
  )
}

export default DraggableWindow
