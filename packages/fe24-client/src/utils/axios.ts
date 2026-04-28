import axios, { type AxiosInstance } from 'axios'
import { notification } from 'antd'
import bus from './bus'
import type { ITimeLineItem } from '@/types/dashboard'

// axios 实例
const httpClient: AxiosInstance = axios.create({
  baseURL: process.env.SERVER_URL || 'http://localhost:3000', // 路由前缀
  timeout: 10000, // 请求超时时间
})

// axios 请求拦截器
httpClient.interceptors.request.use(
  (config) => {
    return Promise.resolve(config)
  },
  (reqErr) => {
    notification.error({
      title: '请求失败',
      description: reqErr.message,
    })
    return Promise.reject(reqErr)
  },
)

// axios 响应拦截器
httpClient.interceptors.response.use(
  (res) => {
    const { code, message: msg } = res.data
    bus.publish('http-response', {
      timestamp: Date.now(),
      message: msg,
    } as ITimeLineItem)
    if (code != 200) {
      notification.error({
        title: '请求失败',
        description: msg,
      })
      throw msg
    }
    return res.data
  },
  (resErr) => {
    notification.error({
      title: 'HTTP 响应错误',
      description: resErr.message,
    })
    throw resErr.message
  },
)

export default httpClient
