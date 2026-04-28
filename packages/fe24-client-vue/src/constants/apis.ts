const version = 'v1'

export const enum Api {
  RobotQuery = `/api/${version}/robotQuery`,
  RobotAdd = `/api/${version}/robotAdd`,
  RobotDelete = `/api/${version}/robotDelete`,
  RobotUpdate = `/api/${version}/robotUpdate`,
  ChartData = `/api/${version}/chartData`,
  ChartData2 = `/api/${version}/chartData2`,
  ChartData3 = `/api/${version}/chartData3`,
  RevenueList = `/api/${version}/revenueList`,
  MarkerList = `/api/${version}/markerList`,
  Login = `/api/${version}/login`,
  OrderQuery = `/api/${version}/orderQuery`,
  OrderDelete = `/api/${version}/orderDelete`,
  AddressList = `/api/${version}/addressList`,
}
