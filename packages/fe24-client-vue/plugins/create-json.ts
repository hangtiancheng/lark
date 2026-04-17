import type { Plugin } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { mockOrderList, mockRobotList } from './mock'
import { randNum } from './utils'

export default function createJsonFiles(): Plugin {
  return {
    name: 'create-json-files',
    configResolved() {
      const jsonPath = path.resolve(process.cwd(), './plugins/assets/robot-list.json')

      const robotList = mockRobotList(randNum(50, 100))
      // 定位到上海市静安区
      robotList[0].lat = 121.391229
      robotList[0].lng = 31.251326
      const jsonStr = JSON.stringify(robotList)
      fs.writeFileSync(jsonPath, jsonStr, { encoding: 'utf8' })

      const jsonPath2 = path.resolve(process.cwd(), './plugins/assets/order-list.json')
      const orderList = mockOrderList(randNum(250, 500), robotList)
      const jsonStr2 = JSON.stringify(orderList)
      fs.writeFileSync(jsonPath2, jsonStr2, { encoding: 'utf8' })
    },
  }
}
