// 路由前置守卫, 前置守卫函数在 redirect 重定向后, 路由跳转前执行
import router from '@/router'
import { useUserStore } from '@/stores/user'
// import { useTabStore } from '@/stores/tab'
//! const userStore = useUserStore()
import { WHITE_LIST } from '@/constants'
import { useTabStore } from '@/stores/tab'
import { ElMessage } from 'element-plus'
// 进度条组件
import ProgressBar from '@/components/common/progress-bar.vue'
import { createVNode, render } from 'vue'
const barVNode = createVNode(ProgressBar)
render(barVNode, document.body)

router.beforeEach(
  (
    to /** (@/router/index.ts
    createRouter
    RouterOptions.routes 重定向后的) 目的路由 */,
    from /** 源路由 */,
    next /** 放行函数 */,
  ) => {
    const userStore = useUserStore()
    if (!WHITE_LIST.has(to.path) && !userStore.token /**  !sessionStorage.getItem('token') */) {
      barVNode.component?.exposed?.loadStart()
      // next('/login')
      next({ path: '/login' }) // 重定向到登录页面
      return
    }

    if (
      userStore.token &&
      (to.path === '/login' ||
        (to.meta?.auths && // 需要权限
          !to.meta.auths!.includes(userStore.auth))) // 没有权限
    ) {
      if (to.path !== '/login') {
        ElMessage.warning({
          message: '您触犯了企鹅高压线!',
          grouping: true,
        })
        next({ name: from.name })
        return
      }

      barVNode.component?.exposed?.loadStart()
      next({ name: 'Home' })
      return
    }

    //! 用户可能刷新页面, 或手动修改地址栏
    //! 所以需要在路由前置守卫这里 addTab, setCurrentTab
    const tabStore = useTabStore()
    const { addTab } = tabStore
    if (to.meta.tagName) {
      const { tagName, icon } = to.meta
      addTab(tagName, icon!, to.path)
    }
    barVNode.component?.exposed?.loadStart()
    next()
  } /** guard 前置守卫函数 */,
)

router.afterEach(
  (/** to, from */) => {
    barVNode.component?.exposed?.loadEnd()
  } /** guard 后置守卫函数 */,
)
