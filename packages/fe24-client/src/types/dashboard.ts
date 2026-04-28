export interface IResData {
  code: number
  message: string
}

export type IChartData = {
  data: {
    name: string
    value: number
  }[]
} & IResData

export type IChartData2 = {
  data: {
    name: string
    data: number[]
  }[]
} & IResData

export type IChartData3 = {
  data: [number, number, number, number, number]
} & IResData

export interface IRevenueItem {
  id: number
  address: string
  revenue: number
}

export type IRevenueList = {
  data: IRevenueItem[]
} & IResData

export interface ITimeLineItem {
  timestamp: number
  message: string
}
