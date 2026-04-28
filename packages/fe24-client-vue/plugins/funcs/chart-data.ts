import { IChartData, IChartData2, IChartData3, IResData } from '../types'
import { Connect } from 'vite'
import { randNum, randArr } from '../utils'

const chartDataFn: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const resData: IChartData & IResData = {
    code: 200,
    message: '获取营收比例成功',
    data: [
      { name: 'A', value: randNum(1, 100) },
      { name: 'B', value: randNum(1, 100) },
      { name: 'C', value: randNum(1, 100) },
    ],
  }
  res.end(JSON.stringify(resData))
}

const chartDataFn2: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const resData: IChartData2 & IResData = {
    code: 200,
    message: '获取充电信息成功',
    data: [
      { name: '充电功率', data: randArr(1, 100, 9) },
      { name: '充电时长', data: randArr(1, 100, 9) },
      { name: '充电量', data: randArr(1, 100, 9) },
    ],
  }
  res.end(JSON.stringify(resData))
}

const chartDataFn3: Connect.NextHandleFunction = (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const resData: IChartData3 & IResData = {
    code: 200,
    message: '获取五边形数据成功',
    data: [randNum(1, 100), randNum(1, 100), randNum(1, 100), randNum(1, 100), randNum(1, 100)],
  }
  res.end(JSON.stringify(resData))
}

export { chartDataFn, chartDataFn2, chartDataFn3 }
