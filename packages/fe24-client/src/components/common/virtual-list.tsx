import React, { useState, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react'
import VirtualListItem from './virtual-list-item'
import type { IRevenueItem } from '@/types/dashboard'

interface VirtualListProps {
  height: number
  itemHeight: number
  fetchLargeList: () => Promise<IRevenueItem[]>
}

export interface VirtualListRef {
  updateLargeList: () => Promise<void>
}

const VirtualList = forwardRef<VirtualListRef, VirtualListProps>(
  ({ height, itemHeight, fetchLargeList }, ref) => {
    const [largeList, setLargeList] = useState<IRevenueItem[]>([])
    const [scrollTop, setScrollTop] = useState(0)

    const loadData = async () => {
      const data = await fetchLargeList()
      setLargeList(data)
    }

    useEffect(() => {
      loadData()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useImperativeHandle(ref, () => ({
      updateLargeList: loadData,
    }))

    const visibleCnt = useMemo(() => Math.ceil(height / itemHeight), [height, itemHeight])

    const startIdx = Math.floor(scrollTop / itemHeight)
    const endIdx = startIdx + visibleCnt

    const visiblePartialList = useMemo(() => {
      return largeList.slice(startIdx, Math.min(endIdx, largeList.length))
    }, [largeList, startIdx, endIdx])

    const startOffset = startIdx * itemHeight
    const largestListHeight = largeList.length * itemHeight

    const handleScroll = (ev: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(ev.currentTarget.scrollTop)
    }

    return (
      <div
        className="relative overflow-auto bg-slate-50"
        onScroll={handleScroll}
        style={{ height: `${height}px` }}
      >
        <div style={{ height: `${largestListHeight}px`, width: 0 }}></div>

        <ul
          className="absolute top-0 left-0 m-0 w-full list-none bg-white p-0"
          style={{
            transform: `translateY(${startOffset}px)`,
          }}
        >
          {visiblePartialList.map((item, index) => {
            // absolute index in largeList
            const realIdx = startIdx + index
            return (
              <li
                key={item.id}
                className="box-border rounded-lg"
                style={{
                  height: `${itemHeight}px`,
                  lineHeight: `${itemHeight}px`,
                }}
              >
                <VirtualListItem item={item} idx={realIdx} />
              </li>
            )
          })}
        </ul>
      </div>
    )
  },
)

VirtualList.displayName = 'VirtualList'

export default VirtualList
