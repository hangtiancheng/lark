import React from 'react'
import { commaSep } from '@/utils/comma-sep'
import type { IRevenueItem } from '@/types/dashboard'

interface VirtualListItemProps {
  item: IRevenueItem
  idx: number
}

const VirtualListItem: React.FC<VirtualListItemProps> = ({ item, idx }) => {
  return (
    <div
      className="flex h-full items-center"
      style={{ background: idx % 2 === 0 ? '#ecfcca' : '#fff' }}
    >
      <div className="w-[20%] text-center">{commaSep(item.revenue)}</div>
      <div className="w-[80%] truncate">{item.address}</div>
    </div>
  )
}

export default VirtualListItem
