import path from 'node:path'
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginSass } from '@rsbuild/plugin-sass'
import RsbuildConditionalBundlePlugin from '@lark/conditional-bundle-plugin/rsbuild'
import createJsonFiles from './plugins/create-json.js'
import {
  createClientEnv,
  createConditionalVars,
  packageRoot,
  resolveSelectedRoutes,
  toProcessEnvDefineMap,
} from './shared.js'

interface RsbuildConfigContext {
  command?: string
  env?: string
  envMode?: string
}

async function registerMockMiddlewares(middlewares: {
  use: (pathName: string, handler: (req: unknown, res: unknown, next: () => void) => void) => void
}) {
  const [{ Api }, funcs] = await Promise.all([
    import('./plugins/constants/index.js'),
    import('./plugins/funcs/index.js'),
  ])

  const routeHandlers = [
    [Api.Login, funcs.loginFn],
    [Api.ChartData, funcs.chartDataFn],
    [Api.ChartData2, funcs.chartDataFn2],
    [Api.ChartData3, funcs.chartDataFn3],
    [Api.RevenueList, funcs.revenueListFn],
    [Api.RobotQuery, funcs.robotQueryFn],
    [Api.RobotAdd, funcs.robotAddFn],
    [Api.RobotUpdate, funcs.robotUpdateFn],
    [Api.RobotDelete, funcs.robotDeleteFn],
    [Api.MarkerList, funcs.markerListFn],
    [Api.OrderQuery, funcs.orderQueryFn],
    [Api.OrderDelete, funcs.orderDeleteFn],
  ] as const

  routeHandlers.forEach(([pathName, handler]) => {
    middlewares.use(pathName, (req, res) => {
      handler(req as never, res as never)
    })
  })
}

function pluginFe24RuntimeSupport() {
  return {
    name: 'fe24-rsbuild-runtime-support',
    setup(api: {
      onBeforeStartDevServer: (
        handler: (params: {
          server: {
            middlewares: {
              use: (
                pathName: string,
                middleware: (req: unknown, res: unknown, next: () => void) => void,
              ) => void
            }
          }
        }) => void | Promise<void>,
      ) => void
      onBeforeBuild: (handler: () => void | Promise<void>) => void
    }) {
      api.onBeforeStartDevServer(async ({ server }) => {
        createJsonFiles()
        await registerMockMiddlewares(server.middlewares)
      })

      api.onBeforeBuild(() => {
        createJsonFiles()
      })
    },
  }
}

export default defineConfig(async ({ command, env, envMode }: RsbuildConfigContext) => {
  const mode = envMode || env || (command === 'dev' ? 'development' : 'production')
  const { routeFlags } = await resolveSelectedRoutes({
    mode,
    interactive: command === 'dev',
  })

  return {
    server: {
      port: 8080,
    },
    html: {
      template: './index.html',
      title: 'FE24 Client',
      favicon: './public/favicon.ico',
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
      define: toProcessEnvDefineMap(createClientEnv(mode, routeFlags)),
    },
    resolve: {
      alias: {
        '@': path.resolve(packageRoot, 'src'),
      },
    },
    output: {
      distPath: {
        root: 'dist-rsbuild',
      },
    },
    plugins: [
      pluginReact(),
      pluginSass(),
      pluginFe24RuntimeSupport(),
      RsbuildConditionalBundlePlugin({
        includes: ['**/*.ts', '**/*.tsx'],
        vars: createConditionalVars(routeFlags),
      }),
    ],
  }
})
