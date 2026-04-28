import '@/assets/tailwind.css'
import '@/assets/global.scss'
import 'animate.css'

import 'element-plus/dist/index.css'
import '@icon-park/vue-next/styles/index.css'

import { createApp, readonly } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
// import App from '@/App'
import router from '@/router'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { toastPlugin, createToast, type IToast } from './components/toast/toast'

// 副作用导入路由守卫文件
import '@/router/guard'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

router.addRoute({ path: '/canvas', component: () => import('@/assets/canvas-demo.vue') })

app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
})

// 自定义 toast Vue 插件
app.use(toastPlugin)

const toast: IToast = createToast()
app.provide<IToast>('toast', readonly(toast))

app.mount('#app')
console.log('import.meta.env.VITE_SERVER_URL:', import.meta.env.VITE_SERVER_URL)
