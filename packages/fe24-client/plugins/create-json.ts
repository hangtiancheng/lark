import fs from 'node:fs'
import path from 'node:path'
import { mockOrderList, mockRobotList } from './mock/index.js'
import { randNum } from './utils/index.js'

export default function createJsonFiles() {
  const root = process.cwd()
  const p = path.resolve(root, 'plugins/assets')

  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true })
  }

  const r_path = path.resolve(p, 'robot-list.json')
  const o_path = path.resolve(p, 'order-list.json')

  if (!fs.existsSync(r_path)) {
    const robotList = mockRobotList(randNum(300, 500))
    fs.writeFileSync(r_path, JSON.stringify(robotList, null, 2))

    if (!fs.existsSync(o_path)) {
      const orderList = mockOrderList(randNum(5000, 10000), robotList)
      fs.writeFileSync(o_path, JSON.stringify(orderList, null, 2))
    }
  }
}
