import { Api } from '@/constants/apis'
import type { IRobotList, IResData } from '@/types/robot'
import { get } from '@/utils/http'

export async function robotQueryApi(params: {
  id?: number
  name?: string
  address?: string
  state?: 0 | 1 | 2 | 3 | 4 | 5
  pageNum?: number
  pageSize?: number
}): Promise<IRobotList> {
  return get(Api.RobotQuery, params)
}

export async function robotAddApi(params: {
  lat?: number
  lng?: number
  name: string
  address: string
  state: 0 | 1 | 2 | 3 | 4 | 5
  failureNum: number
  admin: string
  email: string
}): Promise<IResData> {
  return get(Api.RobotAdd, params)
}

export async function robotUpdateApi(params: {
  id: number
  address: string
  state: 0 | 1 | 2 | 3 | 4 | 5
  failureNum: number
  email: string
}): Promise<IResData> {
  return get(Api.RobotUpdate, params)
}

export async function robotDeleteApi(params: { id: number }): Promise<IResData> {
  return get(Api.RobotDelete, params)
}
