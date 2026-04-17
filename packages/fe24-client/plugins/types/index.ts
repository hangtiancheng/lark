import { adminMenu, userMenu } from '../constants'

export interface IResData {
  code: number
  message: string
}

export interface ILoginResData {
  data?: {
    token: string
    auth: string
    menuList: typeof adminMenu | typeof userMenu
  }
}

export interface IChartData {
  data: {
    name: string
    value: number
  }[]
}

export interface IChartData2 {
  data: {
    name: string
    data: number[]
  }[]
}

export interface IChartData3 {
  data: [number, number, number, number, number]
}

export interface IRevenueList {
  data: {
    id: number
    address: string
    revenue: number
  }[]
}

export type IRobotList = {
  data: {
    id: number
    address: string
    name: string
    state: /* 0 | 1 | 2 | 3 | 4 | 5 */ number
    failureNum: number
    admin: string
    email: string
    lat: number
    lng: number
  }[]
}

export type IOrderList = {
  data: {
    id: string
    state: /* 0 | 1 | 2 | 3 */ number
    robotId: number
    robotName: string
    date: string
  }[]
}
