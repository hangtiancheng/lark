import React from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { authLoader } from './auth-route'

// Lazy loaded pages
const LayoutWrapper = React.lazy(() => import('@/layouts/layout-wrapper'))
const LoginMain = React.lazy(() => import('@/pages/login'))
// #if ROUTE_DASHBOARD
const DashboardMain = React.lazy(() => import('@/pages/dashboard'))
// #endif
// #if ROUTE_MAIN
const FeMain = React.lazy(() => import('@/pages/main'))
// #endif
// #if ROUTE_MAIN_GRID
const RobotGrid = React.lazy(() => import('@/pages/main/robot-grid'))
// #endif
// #if ROUTE_MAP
const MapMain = React.lazy(() => import('@/pages/map'))
// #endif
// #if ROUTE_ORDER
const OrderMain = React.lazy(() => import('@/pages/order'))
// #endif
// #if ROUTE_ORDER_DETAIL
const OrderDetail = React.lazy(() => import('@/pages/order/order-detail'))
// #endif
const EmptyMain = React.lazy(() => import('@/pages/empty'))

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginMain />,
    loader: authLoader,
  },
  {
    path: '/empty',
    element: <EmptyMain />,
    loader: authLoader,
  },
  {
    path: '/',
    element: <LayoutWrapper />,
    loader: authLoader,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      // #if ROUTE_DASHBOARD
      { path: 'dashboard', element: <DashboardMain /> },
      // #endif
      // #if ROUTE_MAIN
      { path: 'main', element: <FeMain /> },
      // #endif
      // #if ROUTE_MAIN_GRID
      { path: 'main/grid', element: <RobotGrid /> },
      // #endif
      // #if ROUTE_MAP
      { path: 'map', element: <MapMain /> },
      // #endif
      // #if ROUTE_ORDER
      { path: 'order', element: <OrderMain /> },
      // #endif
      // #if ROUTE_ORDER_DETAIL
      { path: 'order/detail', element: <OrderDetail /> },
      // #endif
    ],
  },
  {
    path: '*',
    element: <Navigate to="/empty" replace />,
  },
])
