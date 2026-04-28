import { Api } from '@/constants/apis'
import type { ITreeList } from '@/types/map'
import type { IRobotList } from '@/types/robot'
import { get } from '@/utils/http'

export function markerListApi(): Promise<IRobotList> {
  return get(Api.MarkerList)
}

export function addressListApi(): Promise<ITreeList> {
  return get(Api.AddressList)
}
