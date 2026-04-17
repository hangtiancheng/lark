import { useState, useEffect, useCallback } from 'react'

export function usePagination(loadData: () => Promise<void>, initialPageSize: number = 10) {
  const [pageInfo, setPageInfo] = useState({
    pageNum: 1,
    pageSize: initialPageSize,
    total: 0,
  })

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSizeChange = useCallback(
    (newPageSize: number) => {
      setPageInfo((prev) => ({ ...prev, pageSize: newPageSize }))
      loadData()
    },
    [loadData],
  )

  const handleCurrentChange = useCallback(
    (newPageNum: number) => {
      setPageInfo((prev) => ({ ...prev, pageNum: newPageNum }))
      loadData()
    },
    [loadData],
  )

  const resetPagination = useCallback(() => {
    setPageInfo((prev) => ({
      ...prev,
      pageNum: 1,
      pageSize: initialPageSize,
    }))
  }, [initialPageSize])

  const setTotal = useCallback((total: number) => {
    setPageInfo((prev) => ({ ...prev, total }))
  }, [])

  return {
    handleSizeChange,
    handleCurrentChange,
    resetPagination,
    pageInfo,
    setTotal,
    setPageInfo,
  }
}
