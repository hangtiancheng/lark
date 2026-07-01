import { onMounted, reactive } from "vue";

export function usePagination(
  loadData: () => Promise<void>,
  initialPageSize: number = 10,
) {
  onMounted(loadData);

  const pageInfo = reactive({
    pageNum: 1,
    pageSize: initialPageSize,
    total: 0,
  });

  const handleSizeChange = (newPageSize: number) => {
    pageInfo.pageSize = newPageSize;
    loadData();
  };

  const handleCurrentChange = (newPageNum: number) => {
    pageInfo.pageNum = newPageNum;
    loadData();
  };

  const resetPagination = () => {
    pageInfo.pageNum = 1;
    pageInfo.pageSize = initialPageSize;
  };

  const setTotal = (total: number) => {
    pageInfo.total = total;
  };

  const setPageInfo = (info: Partial<typeof pageInfo>) => {
    Object.assign(pageInfo, info);
  };

  return {
    handleSizeChange,
    handleCurrentChange,
    resetPagination,
    pageInfo,
    setTotal,
    setPageInfo,
  };
}
