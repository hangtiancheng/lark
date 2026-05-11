# 命令手册

本页汇总仓库内各项目的 npm scripts 与推荐执行方式。仓库使用 `pnpm` workspace 管理，命令建议在仓库根目录执行；需要进入子目录运行的项目会单独说明。

## 全局命令

| 命令                  | 使用场景       | 说明                              |
| --------------------- | -------------- | --------------------------------- |
| `pnpm dev`            | 开发文档站点   | 启动 VitePress 开发服务器         |
| `pnpm build`          | 构建文档站点   | 执行 VitePress 生产构建           |
| `pnpm preview`        | 预览文档站点   | 本地预览构建产物                  |
| `pnpm format`         | 格式化文档     | 格式化 `docs` 和 `.vitepress`     |
| `pnpm test`           | 批量测试       | 并发执行根脚本中配置的测试任务    |
| `pnpm test:math`      | 金融计算测试   | 调用根脚本中的 math 测试入口      |
| `pnpm test:react-vue` | react-vue 测试 | 调用根脚本中的 react-vue 测试入口 |

> 注意：根脚本来自仓库 `package.json`。如果 workspace 包名发生调整，应优先以各项目 `package.json` 中的包名和脚本为准。

## 条件编译插件

相关目录：

- `packages/conditional-bundle-plugin`
- `packages/fe24-client`
- `packages/fe24-client-vue`

### 插件包

| 命令                                                   | 使用场景             | 说明                                                                      |
| ------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------- |
| `pnpm --filter @lark/conditional-bundle-plugin build`  | 发布或联调前构建插件 | 使用 Rollup 输出 core、Vite、Rollup、esbuild、Rsbuild、Webpack 多入口产物 |
| `pnpm --filter @lark/conditional-bundle-plugin dev`    | 开发插件             | Rollup watch 模式，适合修改核心转换逻辑或适配层时使用                     |
| `pnpm --filter @lark/conditional-bundle-plugin format` | 格式化插件源码       | 对插件包执行 Prettier                                                     |

### React 管理端示例

| 命令                                            | 使用场景       | 说明                                          |
| ----------------------------------------------- | -------------- | --------------------------------------------- |
| `pnpm --filter @lark/fe24-client dev`           | 默认开发       | 等价于 `dev:webpack`，使用 Webpack dev server |
| `pnpm --filter @lark/fe24-client build`         | 默认生产构建   | 等价于 `build:webpack`，验证 Webpack 插件接入 |
| `pnpm --filter @lark/fe24-client dev:webpack`   | Webpack 开发   | 使用 `webpack.config.ts` 启动开发服务         |
| `pnpm --filter @lark/fe24-client build:webpack` | Webpack 构建   | 验证 Webpack 条件编译裁剪产物                 |
| `pnpm --filter @lark/fe24-client build:esbuild` | esbuild 构建   | 验证 esbuild 插件入口                         |
| `pnpm --filter @lark/fe24-client dev:rsbuild`   | Rsbuild 开发   | 验证 Rsbuild 插件入口的开发链路               |
| `pnpm --filter @lark/fe24-client build:rsbuild` | Rsbuild 构建   | 验证 Rsbuild 条件编译产物                     |
| `pnpm --filter @lark/fe24-client build:rollup`  | Rollup 构建    | 验证 Rollup 插件入口                          |
| `pnpm --filter @lark/fe24-client build:all`     | 构建全部路由   | 设置 `SELECTED_ROUTES=*`，用于对比未裁剪产物  |
| `pnpm --filter @lark/fe24-client lint`          | 修复 lint 问题 | 执行 ESLint 自动修复                          |
| `pnpm --filter @lark/fe24-client format`        | 格式化源码     | 格式化 `src` 和 `plugins`                     |

### Vue 管理端示例

| 命令                                             | 使用场景         | 说明                                                     |
| ------------------------------------------------ | ---------------- | -------------------------------------------------------- |
| `pnpm --filter @lark/fe24-client-vue dev`        | Vite 开发        | 启动 Vue 管理端开发服务                                  |
| `pnpm --filter @lark/fe24-client-vue build`      | 常规生产构建     | 先执行类型检查，再执行 Vite build                        |
| `pnpm --filter @lark/fe24-client-vue build:cond` | 条件路由构建     | 设置 `SELECTED_ROUTES=dashboard`，验证 Vite 条件编译裁剪 |
| `pnpm --filter @lark/fe24-client-vue build:all`  | 构建全部路由     | 设置 `SELECTED_ROUTES=*`，用于对比未裁剪产物             |
| `pnpm --filter @lark/fe24-client-vue build-only` | 仅执行 Vite 构建 | 跳过脚本层面的并行编排，直接构建产物                     |
| `pnpm --filter @lark/fe24-client-vue type-check` | 类型检查         | 执行 `vue-tsc --build`                                   |
| `pnpm --filter @lark/fe24-client-vue preview`    | 预览构建产物     | 启动 Vite preview                                        |
| `pnpm --filter @lark/fe24-client-vue lint`       | 修复 lint 问题   | 执行 ESLint 自动修复                                     |
| `pnpm --filter @lark/fe24-client-vue format`     | 格式化源码       | 格式化 `src` 和 `plugins`                                |

## JS 金融计算

相关目录：`packages/math`

| 命令                            | 使用场景         | 说明                                     |
| ------------------------------- | ---------------- | ---------------------------------------- |
| `pnpm --filter @lark/math test` | 运行金融计算单测 | 使用 Vitest 校验金额转换、折扣和报告输出 |
| `pnpm test:math`                | 根目录快捷入口   | 执行根脚本配置的 math 测试任务           |

该项目当前没有单独的 `build` 脚本，主要通过测试验证逻辑正确性。

## Promise A+ 实现

相关目录：`packages/promises-a-plus`

| 命令                                         | 使用场景          | 说明                                                    |
| -------------------------------------------- | ----------------- | ------------------------------------------------------- |
| `pnpm --filter @lark/promises-a-plus build`  | 构建 Promise 实现 | 清理 `dist` 后执行 TypeScript 编译                      |
| `pnpm --filter @lark/promises-a-plus test`   | 运行规范测试      | 先构建，再运行 `dist/index.js` 中的 Promise A+ 测试适配 |
| `pnpm --filter @lark/promises-a-plus lint`   | 修复 lint 问题    | 执行 ESLint 自动修复                                    |
| `pnpm --filter @lark/promises-a-plus format` | 格式化源码        | 对 Promise 包执行 Prettier                              |

## Prompt 管理 MCP

相关目录：

- `packages/mcp`
- `packages/mcp-with-my-promise`

两个包脚本基本一致，标准版使用原生 Promise，实验版接入自实现 Promise。

### 标准版

| 命令                                   | 使用场景     | 说明                                        |
| -------------------------------------- | ------------ | ------------------------------------------- |
| `pnpm --filter @lark/mcp dev`          | 联合开发     | 并发启动 Koa 服务和 Web 管理页 Rollup watch |
| `pnpm --filter @lark/mcp dev:server`   | 仅开发服务端 | 使用 `tsx src/index.ts` 启动 Koa + MCP 服务 |
| `pnpm --filter @lark/mcp dev:client`   | 仅开发前端   | 进入 `src/client` 后执行 Rollup watch       |
| `pnpm --filter @lark/mcp build`        | 完整构建     | 并发构建服务端和管理页                      |
| `pnpm --filter @lark/mcp build:server` | 构建服务端   | 执行 TypeScript 编译                        |
| `pnpm --filter @lark/mcp build:client` | 构建管理页   | 执行客户端 Rollup 构建                      |
| `pnpm --filter @lark/mcp start`        | 启动生产产物 | 先构建，再运行 `dist/index.js`              |
| `pnpm --filter @lark/mcp benchmark`    | 性能压测     | 执行 `scripts/benchmark.ts`                 |
| `pnpm --filter @lark/mcp format`       | 格式化源码   | 对 MCP 包执行 Prettier                      |

### 自实现 Promise 版

| 命令                                                   | 使用场景     | 说明                                                |
| ------------------------------------------------------ | ------------ | --------------------------------------------------- |
| `pnpm --filter @lark/mcp-with-my-promise dev`          | 联合开发     | 并发启动服务端和管理页，用于对比自实现 Promise 版本 |
| `pnpm --filter @lark/mcp-with-my-promise dev:server`   | 仅开发服务端 | 使用 `tsx src/index.ts` 启动服务端                  |
| `pnpm --filter @lark/mcp-with-my-promise dev:client`   | 仅开发前端   | 进入 `src/client` 后执行 Rollup watch               |
| `pnpm --filter @lark/mcp-with-my-promise build`        | 完整构建     | 并发构建服务端和管理页                              |
| `pnpm --filter @lark/mcp-with-my-promise build:server` | 构建服务端   | 执行 TypeScript 编译                                |
| `pnpm --filter @lark/mcp-with-my-promise build:client` | 构建管理页   | 执行客户端 Rollup 构建                              |
| `pnpm --filter @lark/mcp-with-my-promise start`        | 启动生产产物 | 先构建，再运行 `dist/index.js`                      |
| `pnpm --filter @lark/mcp-with-my-promise benchmark`    | 性能压测     | 对自实现 Promise 版本执行 benchmark                 |
| `pnpm --filter @lark/mcp-with-my-promise format`       | 格式化源码   | 对实验版包执行 Prettier                             |

## 网络检测工具

相关目录：`packages/network`

| 命令                                  | 使用场景     | 说明                                          |
| ------------------------------------- | ------------ | --------------------------------------------- |
| `pnpm --filter @lark/network dev`     | 开发诊断面板 | 启动 Vite 开发服务器                          |
| `pnpm --filter @lark/network build`   | 生产构建     | 执行 TypeScript build mode，再执行 Vite build |
| `pnpm --filter @lark/network preview` | 预览产物     | 启动 Vite preview                             |
| `pnpm --filter @lark/network lint`    | 检查代码质量 | 执行 ESLint 检查                              |
| `pnpm --filter @lark/network format`  | 格式化源码   | 对网络检测工具执行 Prettier                   |

## Mini Vue

相关目录：`packages/not-vue`

该项目没有 `package.json` scripts，构建与开发由 Go 脚本 `bundle.go` 负责，需要进入项目目录执行。

| 命令                                            | 使用场景             | 说明                                                            |
| ----------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| `cd packages/not-vue && go run bundle.go dev`   | 开发预览             | 注入模板、编译 TypeScript、启动静态服务，并在退出时清理生成文件 |
| `cd packages/not-vue && go run bundle.go build` | 生成浏览器可运行产物 | 注入模板并编译生成 `index.js`、`vendor.js`                      |

## 番茄钟

相关目录：`packages/pomodoro`

| 命令                                   | 使用场景        | 说明                                    |
| -------------------------------------- | --------------- | --------------------------------------- |
| `pnpm --filter @lark/pomodoro dev`     | Lynx / Web 开发 | 启动 Rspeedy 开发服务，支持扫码和热更新 |
| `pnpm --filter @lark/pomodoro build`   | 生产构建        | 执行 Rspeedy build，输出跨端产物        |
| `pnpm --filter @lark/pomodoro preview` | 预览产物        | 启动 Rspeedy preview                    |
| `pnpm --filter @lark/pomodoro check`   | 检查并修复      | 执行 Biome check，并写入修复            |
| `pnpm --filter @lark/pomodoro format`  | 格式化源码      | 执行 Biome format                       |

## 全局搜索框

相关目录：

- `packages/react-vue`
- `packages/react-vue-demo`

### react-vue 适配库

| 命令                                   | 使用场景       | 说明                                                         |
| -------------------------------------- | -------------- | ------------------------------------------------------------ |
| `pnpm --filter @lark/react-vue dev`    | 开发适配库     | Rollup watch 模式                                            |
| `pnpm --filter @lark/react-vue build`  | 构建适配库     | 输出 CJS、ESM、浏览器产物和类型声明                          |
| `pnpm --filter @lark/react-vue test`   | 运行适配层测试 | 使用 Vitest 覆盖 `useSetup`、computed、watch、生命周期等能力 |
| `pnpm --filter @lark/react-vue lint`   | 修复 lint 问题 | 执行 ESLint 自动修复                                         |
| `pnpm --filter @lark/react-vue format` | 格式化源码     | 对适配库执行 Prettier                                        |
| `pnpm test:react-vue`                  | 根目录快捷入口 | 执行根脚本配置的 react-vue 测试任务                          |

### 搜索 Demo 应用

| 命令                                        | 使用场景       | 说明                             |
| ------------------------------------------- | -------------- | -------------------------------- |
| `pnpm --filter @lark/react-vue-demo dev`    | 开发全局搜索框 | 启动 Vite，开发环境启用 MSW mock |
| `pnpm --filter @lark/react-vue-demo build`  | 生产构建       | 执行 Vite build                  |
| `pnpm --filter @lark/react-vue-demo serve`  | 预览产物       | 执行 Vite preview                |
| `pnpm --filter @lark/react-vue-demo lint`   | 修复 lint 问题 | 对 `src` 执行 ESLint 自动修复    |
| `pnpm --filter @lark/react-vue-demo format` | 格式化源码     | 对 `src` 执行 Prettier           |

## 常见使用路径

| 目标                  | 推荐命令                                              |
| --------------------- | ----------------------------------------------------- |
| 预览文档站点          | `pnpm dev`                                            |
| 验证文档能否构建      | `pnpm build`                                          |
| 验证条件编译插件产物  | `pnpm --filter @lark/conditional-bundle-plugin build` |
| 验证 Webpack 条件裁剪 | `pnpm --filter @lark/fe24-client build:webpack`       |
| 验证 Vite 条件裁剪    | `pnpm --filter @lark/fe24-client-vue build:cond`      |
| 验证 Promise A+ 实现  | `pnpm --filter @lark/promises-a-plus test`            |
| 启动 Prompt MCP       | `pnpm --filter @lark/mcp dev`                         |
| 启动网络检测工具      | `pnpm --filter @lark/network dev`                     |
| 启动番茄钟            | `pnpm --filter @lark/pomodoro dev`                    |
| 启动全局搜索框 Demo   | `pnpm --filter @lark/react-vue-demo dev`              |
