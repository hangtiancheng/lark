import { createRouter, createWebHistory } from 'vue-router'
import routes from '@/router/routes'

const router = createRouter(
  {
    history: createWebHistory(),

    // 滚动行为, 仅 history.pushState 时可用
    scrollBehavior: (to, from, savedPosition) => {
      // 滚动到原位置
      if (savedPosition) {
        return savedPosition
      }
      // 滚动到锚点
      if (to.hash) {
        return {
          el: to.hash,
          behavior: 'smooth',
        }
      }
      // 滚动到顶部
      return {
        top: 0,
      }
      // 延迟滚动
      // return new Promise((resolve, reject) => {
      //   setTimeout(() => {
      //     resolve({
      //       left: 0,
      //       top: 0
      //     })
      //  }, 1000)
      // })
    },

    routes,
  } /** RouterOptions */,
)

export default router
