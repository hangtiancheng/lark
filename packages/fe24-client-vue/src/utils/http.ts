/* eslint-disable @typescript-eslint/no-explicit-any */
import httpClient from '@/utils/axios'

interface IResponseData {
  code: number
  message: string
  data: any
}

async function get(url: string, params?: any): Promise<IResponseData> {
  return httpClient.get(url, { params })
}

async function post(url: string, data?: any): Promise<IResponseData> {
  return httpClient.post(url, data)
}

export { get, post }
