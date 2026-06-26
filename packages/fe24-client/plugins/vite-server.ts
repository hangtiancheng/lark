import type { Plugin } from 'vite'
import { Api } from './constants'
import {
  chartDataFn,
  chartDataFn2,
  chartDataFn3,
  revenueListFn,
  loginFn,
  robotAddFn,
  robotDeleteFn,
  robotQueryFn,
  markerListFn,
  robotUpdateFn,
  orderQueryFn,
  orderDeleteFn,
} from './funcs'

export default function viteServer(): Plugin {
  return {
    name: 'vite-server',
    configureServer(server) {
      server.middlewares.use(Api.Login, loginFn)
      server.middlewares.use(Api.ChartData, chartDataFn)
      server.middlewares.use(Api.ChartData2, chartDataFn2)
      server.middlewares.use(Api.ChartData3, chartDataFn3)
      server.middlewares.use(Api.RevenueList, revenueListFn)
      server.middlewares.use(Api.RobotQuery, robotQueryFn)
      server.middlewares.use(Api.RobotAdd, robotAddFn)
      server.middlewares.use(Api.RobotUpdate, robotUpdateFn)
      server.middlewares.use(Api.RobotDelete, robotDeleteFn)
      server.middlewares.use(Api.MarkerList, markerListFn)
      server.middlewares.use(Api.OrderQuery, orderQueryFn)
      server.middlewares.use(Api.OrderDelete, orderDeleteFn)
    },
  }
}
