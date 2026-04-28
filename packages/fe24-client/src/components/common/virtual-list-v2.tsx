import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import VirtualListItem from './virtual-list-item'
import type { IRevenueItem } from '@/types/dashboard'

interface VirtualListV2Props {
  height: number
  itemHeight: number
  fetchLargeList: () => Promise<IRevenueItem[]>
}

export interface VirtualListV2Ref {
  updateLargeList: () => Promise<void>
}

const VirtualListV2 = forwardRef<VirtualListV2Ref, VirtualListV2Props>(
  ({ height, itemHeight, fetchLargeList }, ref) => {
    const [largeList, setLargeList] = useState<IRevenueItem[]>([])
    const parentRef = useRef<HTMLDivElement>(null)

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

    const rowVirtualizer = useVirtualizer({
      count: largeList.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => itemHeight,
      overscan: 5,
    })

    return (
      <div
        ref={parentRef}
        className="w-full overflow-auto"
        style={{
          height: `${height}px`,
          scrollbarWidth: 'none',
        }}
      >
        <div
          className="relative w-full"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = largeList[virtualRow.index]
            if (!item) return null

            return (
              <div
                key={virtualRow.index}
                className="absolute top-0 left-0 w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <VirtualListItem item={item} idx={virtualRow.index} />
              </div>
            )
          })}
        </div>
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    )
  },
)

VirtualListV2.displayName = 'VirtualListV2'

export default VirtualListV2
