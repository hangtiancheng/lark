import type { Application } from 'express'

export async function setupMockMiddlewares(app: Application) {
  const { Api } = await import('./constants/index.js')
  const {
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
  } = await import('./funcs/index.js')

  app.get(Api.Login, loginFn)
  app.get(Api.ChartData, chartDataFn)
  app.get(Api.ChartData2, chartDataFn2)
  app.get(Api.ChartData3, chartDataFn3)
  app.get(Api.RevenueList, revenueListFn)
  app.get(Api.RobotQuery, robotQueryFn)
  app.get(Api.RobotAdd, robotAddFn)
  app.get(Api.RobotUpdate, robotUpdateFn)
  app.get(Api.RobotDelete, robotDeleteFn)
  app.get(Api.MarkerList, markerListFn)
  app.get(Api.OrderQuery, orderQueryFn)
  app.get(Api.OrderDelete, orderDeleteFn)
}
