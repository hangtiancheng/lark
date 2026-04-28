import { create } from 'zustand'
import type { IRobotItem } from '@/types/robot'

interface IRobotStore {
  rowData: IRobotItem
  setRowData: (newRowData: IRobotItem) => void
  resetRowData: () => void
}

const defaultRowData: IRobotItem = {
  id: 0,
  name: '',
  address: '',
  state: 1,
  failureNum: 0,
  admin: '',
  email: '',
}

export const useRobotStore = create<IRobotStore>((set) => ({
  rowData: defaultRowData,
  setRowData: (newRowData) => set({ rowData: newRowData }),
  resetRowData: () => set({ rowData: defaultRowData }),
}))
