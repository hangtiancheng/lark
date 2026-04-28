import axios, { type AxiosInstance } from 'axios'
import { ElNotification } from 'element-plus'
import { h } from 'vue'
import bus from './bus'
import type { ITimeLineItem } from '@/types/dashboard'

// const appInstance = getCurrentInstance()
// const proxy = appInstance?.proxy

// axios 实例
const httpClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL, // 路由前缀
  timeout: 10000, // 请求超时时间
})

// axios 请求拦截器
httpClient.interceptors.request.use(
  (config) => {
    // 等价于 return config
    return Promise.resolve(config)
  },
  (reqErr) => {
    ElNotification({
      title: '请求失败',
      message: h('p', { class: 'text-red-500' }, reqErr.message),
      type: 'error',
    })
    // 等价于 throw reqErr
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
      ElNotification({
        title: '请求失败',
        message: h('p', { class: 'text-red-500' }, msg),
        type: 'error',
      })
      throw msg
    }
    // proxy?.$toast.success(msg)
    return res.data
  },
  (resErr) => {
    ElNotification({
      title: 'HTTP 响应错误',
      message: h('p', { class: 'text-red-500' }, resErr.message),
      type: 'error',
    })
    throw resErr.message
  },
)

export default httpClient
