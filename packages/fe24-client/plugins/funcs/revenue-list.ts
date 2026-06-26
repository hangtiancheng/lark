import { Connect } from 'vite'
import { IRevenueList, IResData } from '../types'
import { mockRevenueList } from '../mock'
import { randNum } from '../utils'

const revenueListFn: Connect.NextHandleFunction = (req, res) => {
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
