/* eslint-disable @typescript-eslint/no-unused-vars */
import { onMounted, reactive } from 'vue'

export function usePagination(loadData: () => Promise<void>, initialPageSize: number = 10) {
  // loadData();
  onMounted(loadData)

  const pageInfo = reactive({
    pageNum: 1,
    pageSize: initialPageSize,
    total: 0,
  })

  const handleSizeChange = (newPageSize: number) => {
    // pageInfo.pageSize = newPageSize
    loadData()
  }

  const handleCurrentChange = (newPageNum: number) => {
    // pageInfo.pageNum = newPageNum
    loadData()
  }

  const resetPagination = () => {
    pageInfo.pageNum = 1
    pageInfo.pageSize = initialPageSize
  }

  return {
    handleSizeChange,
    handleCurrentChange,
    resetPagination,
    pageInfo,
  }
}
