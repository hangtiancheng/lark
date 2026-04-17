import type { Request, Response } from 'express'
import { IRevenueList, IResData } from '../types/index.js'
import { mockRevenueList } from '../mock/index.js'
import { randNum } from '../utils/index.js'

const revenueListFn = (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  const revenueListData = mockRevenueList(randNum(1000, 2000) /** amount */)
  const resData: IRevenueList & IResData = {
    code: 200,
    message: '获取营收排行榜成功',
    data: revenueListData.revenueList,
  }
  resData.data.sort((a, b) => b.revenue! - a.revenue!)
  res.end(JSON.stringify(resData))
}

export default revenueListFn
