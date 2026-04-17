import type { Request, Response } from 'express'
import fs from 'node:fs'
import { IRobotList } from '../types/index.js'

function readRobotList(): IRobotList['data'] {
  const jsonStr = fs.readFileSync('./plugins/assets/robot-list.json', 'utf8')
  return JSON.parse(jsonStr)
}

export const markerListFn = (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  const resData = readRobotList()
  // resData[0].lng = 31.251326
  // resData[0].lat = 121.391229
  res.end(
    JSON.stringify({
      code: 200,
      message: '获取地图标记列表成功',
      data: { list: resData },
    }),
  )
}
