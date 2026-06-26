import { Connect } from 'vite'
import url from 'node:url'
import fs from 'node:fs'
import type { IRobotList } from '../types'

function readRobotList(): IRobotList['data'] {
  const jsonStr = fs.readFileSync('./plugins/assets/robot-list.json', 'utf8')
  return JSON.parse(jsonStr)
}

function writeRobotList(robotList: IRobotList['data']) {
  const jsonStr = JSON.stringify(robotList)
  fs.writeFileSync('./plugins/assets/robot-list.json', jsonStr, {
    encoding: 'utf8',
  })
}

export const robotQueryFn: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const parseUrl = url.parse(req.originalUrl!, true /* parseQueryString */).query
  const {
    id /** 机器人 ID */,
    name /** 机器人名字 */,
    address /** 机器人地址 */,
    state /** 机器人状态 */,
    pageNum /** 起始页号 */,
    pageSize /** 页面大小 */,
  } = parseUrl

  // const deepClone: () => typeof robotList = () => {
  //   const deepClonedList: typeof robotList = []
  //   for (const robot of robotList) {
  //     deepClonedList.push({ ...robot })
  //   }
  //   return deepClonedList
  // }

  let resData = readRobotList() // 不需要深拷贝
  if (id) {
    resData = resData.filter((item) => item.id === Number.parseInt(id as string))
    res.end(
      JSON.stringify({
        code: 200,
        message: '获取机器人列表成功',
        data: { list: resData, total: 1 },
      }),
    )
    return
  }

  if (name) {
    resData = resData.filter((item) => item.name?.includes(name as string))
  }

  if (address) {
    resData = resData.filter((item) => item.address?.includes(address as string))
  }

  if (state && Number.parseInt(state as string) > 0) {
    resData = resData.filter((item) => item.state === Number.parseInt(state as string))
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
      message: '获取机器人列表成功',
      data: { list: resData, total },
    }),
  )
}

export const robotAddFn: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const parseUrl = url.parse(req.originalUrl!, true /* parseQueryString */).query
  const { name, address, state, failureNum, admin, email, lat, lng } = parseUrl
  const robotList = readRobotList()

  robotList.unshift({
    id: robotList.length + 1,
    name: name as string,
    address: address as string,
    state: Number.parseInt(state as string),
    failureNum: Number.parseInt(failureNum as string),
    admin: admin as string,
    email: email as string,
    // 如果未传递 lng, 则随机生成一个
    lng: Number.parseFloat((lng as string) ?? (Math.random() * (30 - 28) + 28).toFixed(6)),
    // 如果未传递 lat, 则随机生成一个
    lat: Number.parseFloat((lat as string) ?? (Math.random() * (120 - 118) + 118).toFixed(6)),
  })
  writeRobotList(robotList)

  res.end(
    JSON.stringify({
      code: 200,
      message: '新增机器人成功',
    }),
  )
}

export const robotDeleteFn: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const parseUrl = url.parse(req.originalUrl!, true /* parseQueryString */).query
  const { id } = parseUrl
  let robotList = readRobotList()
  robotList = robotList.filter((item) => item.id !== Number.parseInt(id as string))
  writeRobotList(robotList)
  res.end(
    JSON.stringify({
      code: 200,
      message: '删除机器人成功',
    }),
  )
  return
}

export const robotUpdateFn: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const parseUrl = url.parse(req.originalUrl!, true /* parseQueryString */).query
  const { id, address, state, failureNum, email } = parseUrl
  const robotList = readRobotList()
  const robot = robotList.find((item) => item.id === Number.parseInt(id as string))
  if (!robot) {
    res.end(
      JSON.stringify({
        code: 400,
        message: '更新机器人失败, 机器人不存在',
      }),
    )
    return
  }
  // robot.name
  robot.address = address as string
  robot.state = Number.parseInt(state as string)
  // robot.admin
  robot.failureNum = Number.parseInt(failureNum as string)
  robot.email = email as string
  writeRobotList(robotList)
  res.end(
    JSON.stringify({
      code: 200,
      message: '更新机器人成功',
    }),
  )
}
