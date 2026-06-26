import type { IRobotItem } from '@/types/robot'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRobotStore = defineStore('robot', () => {
  const defaultRowData: IRobotItem = {
    id: 0, // id > 0
    name: '',
    address: '',
    state: 1,
    failureNum: 0,
    admin: '',
    email: '',
  }

  // state
  const rowData = ref<IRobotItem>(defaultRowData)

  // actions
  const setRowData = (newRowData: IRobotItem) => {
    rowData.value = newRowData
  }

  const resetRowData = () => {
    rowData.value = defaultRowData
  }

  return {
    rowData,
    setRowData,
    resetRowData,
  }
})
