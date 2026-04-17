import type { IResData } from './dashboard'
export type { IResData }

export interface IOrderItem {
  id: string
  state:
    | 0 // 全部
    | 1
    | 2
    | 3
  robotId: number
  robotName: string
  date: string
}

export type IOrderList = {
  data: {
    list: IOrderItem[]
    total: number
  }
} & IResData
