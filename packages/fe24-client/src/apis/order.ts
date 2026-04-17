import { Api } from '@/constants/apis'
import type { IOrderList, IResData } from '@/types/order'
import { get } from '@/utils/http'

export function orderQueryApi(params: {
  id?: string
  state?: 0 | 1 | 2 | 3
  robotId?: number
  robotName?: string
  startDate?: string
  endDate?: string
  pageNum?: number
  pageSize?: number
}): Promise<IOrderList> {
  return get(Api.OrderQuery, params)
}

export async function orderDeleteApi(params: { idList: string[] }): Promise<IResData> {
  return get(Api.OrderDelete, { idList: JSON.stringify(params.idList) })
}
