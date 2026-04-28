import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    tagName?: string
    icon?: string
    auths?: string[]
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/layouts/layout-main.vue'),
    redirect: {
      name: 'Empty',
    },
    children: [
      {
        path: '/empty',
        name: 'Empty',
        component: () => import('@/pages/empty-main.vue'),
      },
      // #if ROUTE_DASHBOARD
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/dashboard/dashboard-main.vue'),
        meta: {
          tagName: '数据看板',
          icon: 'DataScreen',
        },
      },
      // #endif
      // #if ROUTE_MAIN
      {
        path: '/main',
        name: 'fe24',
        component: () => import('@/pages/main/fe-main.vue'),
        meta: {
          tagName: '机器人列表',
          icon: 'SurveillanceCameras',
        },
      },
      // #endif
      // #if ROUTE_MAIN_GRID
      {
        path: '/main/grid',
        name: 'Robot',
        component: () => import('@/pages/main/robot-grid.vue'),
        meta: {
          tagName: '机器人网格',
          icon: 'RobotOne',
        },
      },
      // #endif
      // #if ROUTE_MAP
      {
        path: '/map',
        name: 'Map',
        component: () => import('@/pages/map/map-main.vue'),
        meta: {
          tagName: 'Web 地图',
          icon: 'LocalTwo',
        },
      },
      // #endif
      // #if ROUTE_ORDER
      {
        path: '/order',
        name: 'Order',
        component: () => import('@/pages/order/order-main.vue'),
        meta: {
          tagName: '订单管理',
          icon: 'Order',
        },
      },
      // #endif
      // #if ROUTE_ORDER_DETAIL
      {
        path: '/order/detail',
        name: 'Detail',
        component: () => import('@/pages/order/order-detail.vue'),
        meta: {
          tagName: '订单详情',
          icon: 'Find',
        },
      },
      // #endif
    ],
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login-main.vue'),
  },
  {
    path: '/:pathMatch(.*)*', // 匹配未定义的任意路由
    redirect: {
      name: 'Empty',
    },
  },
]

export default routes
