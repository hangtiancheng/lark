import type { IResData } from './dashboard'
export type { IResData }

export interface IRobotItem {
  id: number
  name: string
  address: string
  state:
    | 0 // 全部
    | 1 // 闲置
    | 2 // 使用
    | 3 // 故障
    | 4 // 维修
    | 5 // 报废
  failureNum: number
  admin: string
  email: string
  lat?: number
  lng?: number
}

export type IRobotList = {
  data: {
    list: IRobotItem[]
    total?: number
  }
} & IResData
