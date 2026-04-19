import fs from 'node:fs'
import path from 'node:path'
import { mockOrderList, mockRobotList } from './mock/index.js'
import { randNum } from './utils/index.js'

export default function createJsonFiles() {
  const assetsDir = path.resolve(process.cwd(), 'plugins/assets')

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true })
  }

  const robotList = mockRobotList(randNum(50, 100))
  robotList[0].lat = 121.391229
  robotList[0].lng = 31.251326

  fs.writeFileSync(path.resolve(assetsDir, 'robot-list.json'), JSON.stringify(robotList), {
    encoding: 'utf8',
  })

  const orderList = mockOrderList(randNum(250, 500), robotList)
  fs.writeFileSync(path.resolve(assetsDir, 'order-list.json'), JSON.stringify(orderList), {
    encoding: 'utf8',
  })
}
