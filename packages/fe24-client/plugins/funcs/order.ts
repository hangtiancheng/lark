import type { IOrderList } from '../types'
import fs from 'node:fs'
import { Connect } from 'vite'
import url from 'node:url'

function readOrderList(): IOrderList['data'] {
  const jsonStr = fs.readFileSync('./plugins/assets/order-list.json', 'utf8')
  return JSON.parse(jsonStr)
}

function writeOrderList(orderList: IOrderList['data']) {
  const jsonStr = JSON.stringify(orderList)
  fs.writeFileSync('./plugins/assets/order-list.json', jsonStr, {
    encoding: 'utf8',
  })
}

export const orderQueryFn: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const parseUrl = url.parse(req.originalUrl!, true /* parseQueryString */).query
  const {
    id /** 订单号 */,
    state /** 订单状态 */,
    robotId /** 机器人 ID */,
    robotName /** 机器人名字 */,
    startDate /** 开始日期 */,
    endDate /** 结束日期 */,
    pageNum /** 起始页号 */,
    pageSize /** 页面大小 */,
  } = parseUrl

  let resData = readOrderList() // 不需要深拷贝

  if (id) {
    resData = resData.filter((item) => item.id.includes(id as string))
    res.end(
      JSON.stringify({
        code: 200,
        message: '获取订单列表成功',
        data: { list: resData, total: 1 },
      }),
    )
    return
  }

  if (state && Number.parseInt(state as string) > 0) {
    resData = resData.filter((item) => item.state === Number.parseInt(state as string))
  }

  if (robotId) {
    resData = resData.filter((item) => item.robotId === Number.parseInt(robotId as string))
  }

  if (robotName) {
    resData = resData.filter((item) => item.robotName.includes(robotName as string))
  }

  if (startDate && endDate) {
    const [startYear_, startMonth_, startDay_] = (startDate as string).split('-')
    const [startYear, startMonth, startDay] = [
      Number.parseInt(startYear_),
      Number.parseInt(startMonth_),
      Number.parseInt(startDay_),
    ]
    const [endYear_, endMonth_, endDay_] = (endDate as string).split('-')
    const [endYear, endMonth, endDay] = [
      Number.parseInt(endYear_),
      Number.parseInt(endMonth_),
      Number.parseInt(endDay_),
    ]
    resData = resData.filter((item) => {
      const [year_, month_, day_] = item.date.split('-')
      const [year, month, day] = [
        Number.parseInt(year_),
        Number.parseInt(month_),
        Number.parseInt(day_),
      ]
      if (
        (year > startYear && year < endYear) ||
        (year === startYear && month > startMonth) ||
        (year === startYear && month === startMonth && day >= startDay) ||
        (year === endYear && month < endMonth) ||
        (year === endYear && month === endMonth && day <= endDay)
      ) {
        return true
      }
      return false
    })
  }

  const total = resData.length
  if (Number.parseInt(pageSize as string) > 0) {
    const start = (Number.parseInt(pageNum as string) - 1) * Number.parseInt(pageSize as string)
    const end = start + Number.parseInt(pageSize as string)
    resData = resData.slice(start, end)
  }

  res.end(
    JSON.stringify({
      code: 200,
      message: '获取订单列表成功',
      data: { list: resData, total },
    }),
  )
}

export const orderDeleteFn: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const parseUrl = url.parse(req.originalUrl!, true /* parseQueryString */).query
  const { idList } = parseUrl
  let orderList = readOrderList()
  orderList = orderList.filter((item) => !(idList as string[]).includes(item.id))
  writeOrderList(orderList)
  res.end(
    JSON.stringify({
      code: 200,
      message: '批量删除订单成功',
    }),
  )
}
