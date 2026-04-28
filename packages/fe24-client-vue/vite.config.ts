import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

import viteServer from './plugins/vite-server'
import { visualizer } from 'rollup-plugin-visualizer'
import createJsonFiles from './plugins/create-json'
import ViteConditionalBundlePlugin from '@lark/conditional-bundle-plugin/vite'
import { checkbox } from '@inquirer/prompts'

// https://vite.dev/config/
export default defineConfig(async ({ command }) => {
  console.log('command', command)
  let selectedRoutes = process.env.SELECTED_ROUTES ? process.env.SELECTED_ROUTES.split(',') : null

  if (command === 'build' && !selectedRoutes) {
    const choices = [
      { name: 'All Routes', value: '*' },
      { name: 'Dashboard', value: 'dashboard', checked: true },
      { name: 'Main (fe24)', value: 'main' },
      { name: 'Robot Grid', value: 'main/grid' },
      { name: 'Map', value: 'map' },
      { name: 'Order', value: 'order' },
      { name: 'Order Detail', value: 'order/detail' },
    ]

    try {
      selectedRoutes = await checkbox({
        message: 'Select routes to compile:',
        choices,
        required: true,
      })
    } catch {
      console.log('Using default routes')
      selectedRoutes = ['dashboard', 'main', 'main/grid', 'map', 'order', 'order/detail']
    }
  }

  // Create a record for fast lookup
  const isAllRoutes = selectedRoutes && selectedRoutes.includes('*')
  const allRoutes = ['dashboard', 'main', 'main/grid', 'map', 'order', 'order/detail']
  const routesToCompile = isAllRoutes ? allRoutes : selectedRoutes || []

  const activeRoutes = routesToCompile.reduce(
    (acc, route) => {
      acc[`ROUTE_${route.toUpperCase().replace(/\//g, '_')}`] = true
      return acc
    },
    {} as Record<string, boolean>,
  )

  return {
    plugins: [
      ViteConditionalBundlePlugin({
        includes: ['**/*.ts', '**/*.tsx', '**/*.vue'],
        vars: {
          MY_ENV: process.env.MY_ENV || 'prod',
          app: process.env.app || '1',
          ...activeRoutes,
        },
      }),
      viteServer(),
      vue(),
      vueJsx(),
      vueDevTools(),
      tailwindcss(),
      // ./plugins/assets/robot-list.json
      // ./plugins/assets/order-list.json
      createJsonFiles(),
      visualizer({ open: true }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern', // 清除 legacy-js-api 警告
        },
      },
    },
    // server: {
    //   proxy: {
    //     '/api/v1': {
    //       target: 'http://localhost:3000',
    //       changeOrigin: true,
    //       // rewrite: (path) => path.replace(/^\/api\/v1/, '/api'),
    //     },
    //   },
    // },
    build: {
      // 代码块 (chunk) 大小 >2000 KiB 时警告
      chunkSizeWarningLimit: 2000,
      cssCodeSplit: true, // 开启 CSS 拆分
      sourcemap: false, // 不生成源代码映射文件 sourcemap
      minify: 'esbuild', // 最小化混淆, esbuild 打包速度最快, terser 打包体积最小
      cssMinify: 'esbuild', // CSS 最小化混淆
      assetsInlineLimit: 5000, // 静态资源大小 <5000 Bytes 时, 将打包为 base64
    },
  } as UserConfig
})
