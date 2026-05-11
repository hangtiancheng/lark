# 项目摘要

本页介绍仓库内 8 个前端工程实践项目的定位、源码范围和阅读入口。若需要运行命令，请查看 [命令手册](/guide/commands)。

## 项目一览

| 项目         | 摘要                                                                                                                    | 源码范围                                                                                 | 文档                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| 条件编译插件 | 在构建阶段按变量裁剪源码，统一支持 Webpack、Vite、Rollup、esbuild、Rsbuild，并通过 React / Vue 管理端验证路由裁剪场景。 | `packages/conditional-bundle-plugin`、`packages/fe24-client`、`packages/fe24-client-vue` | [详情](/projects/conditional-bundle-plugin) |
| JS 金融计算  | 使用 `bigint` 处理金额，避免浮点误差进入购物车总价、折扣计算和格式化报告。                                              | `packages/math`                                                                          | [详情](/projects/js-finance)                |
| Promise      | 从 0 实现 Promise A+，覆盖状态机、then 链式调用、thenable 解析、静态方法和测试适配器。                                  | `packages/promises-a-plus`                                                               | [详情](/projects/promise)                   |
| Prompt MCP   | 提供 Prompt 的 Web 管理页、REST API 和 MCP prompts / tools 能力，并提供接入自实现 Promise 的实验版本。                  | `packages/mcp`、`packages/mcp-with-my-promise`                                           | [详情](/projects/prompt-mcp)                |
| 网络检测工具 | 由诊断 SDK 与 React 面板组成，采集网络状态、接口连通性、资源可用性，并支持自定义诊断任务和修复动作。                    | `packages/network`                                                                       | [详情](/projects/network)                   |
| Mini Vue     | 用小型运行时演示 Vue 核心机制，包括 Proxy 响应式代理、模板绑定、computed 和批处理 DOM 更新。                            | `packages/not-vue`                                                                       | [详情](/projects/mini-vue)                  |
| 番茄钟       | 基于 ReactLynx、Lynx、Rspeedy 和 TailwindCSS 的跨端番茄钟应用，用于验证 Lynx 工程链路和 Hook 状态机。                   | `packages/pomodoro`                                                                      | [详情](/projects/pomodoro)                  |
| 全局搜索框   | 由 `react-vue` 适配库和搜索 Demo 组成，验证在 React 中复用 Vue Composition API，并实现缓存、请求、键盘导航和 MSW mock。 | `packages/react-vue`、`packages/react-vue-demo`                                          | [详情](/projects/global-search)             |

## 技术主题

| 主题       | 相关项目                                                                                                 | 说明                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 构建工程化 | [条件编译插件](/projects/conditional-bundle-plugin)、[番茄钟](/projects/pomodoro)                        | 覆盖构建器插件、源码裁剪、Rspeedy 多环境构建和跨端 bundle 输出。                |
| 运行时原理 | [Promise](/projects/promise)、[Mini Vue](/projects/mini-vue)、[全局搜索框](/projects/global-search)      | 拆解异步状态机、响应式代理、模板编译、React / Vue 响应式桥接。                  |
| 数据与服务 | [JS 金融计算](/projects/js-finance)、[Prompt MCP](/projects/prompt-mcp)                                  | 覆盖金额精度、折扣规则、Koa 服务、MongoDB 数据层和 MCP 能力注册。               |
| 业务组件   | [网络检测工具](/projects/network)、[全局搜索框](/projects/global-search)、[番茄钟](/projects/pomodoro)   | 覆盖可交互组件的状态管理、异步请求、可用性反馈和跨端 UI。                       |
| 可测试性   | [JS 金融计算](/projects/js-finance)、[Promise](/projects/promise)、[全局搜索框](/projects/global-search) | 包含 Vitest 单测、Promise A+ 测试适配、React Testing Library 用例和 mock 数据。 |

## 推荐阅读路径

### 构建与工程化

1. [条件编译插件](/projects/conditional-bundle-plugin)
2. [番茄钟](/projects/pomodoro)

先理解条件编译插件如何把公共转换核心接入不同构建器，再阅读番茄钟如何通过 Rspeedy 构建 Web 与 Lynx 产物。

### 运行时与框架机制

1. [Promise](/projects/promise)
2. [Mini Vue](/projects/mini-vue)
3. [全局搜索框](/projects/global-search)

Promise 文档说明异步状态机和 thenable 解析，Mini Vue 展示响应式和模板绑定，全局搜索框进一步说明如何把 Vue Composition API 接入 React。

### 业务系统与产品能力

1. [JS 金融计算](/projects/js-finance)
2. [网络检测工具](/projects/network)
3. [Prompt MCP](/projects/prompt-mcp)
4. [全局搜索框](/projects/global-search)

这条路径适合关注可落地业务能力的读者。金融计算强调确定性与精度，网络检测工具强调诊断扩展性，Prompt MCP 展示服务与协议集成，全局搜索框展示复杂组件的状态拆分和交互闭环。

## 文档维护约定

- 新增项目时，同步更新本页项目一览、首页项目索引和 [命令手册](/guide/commands)。
- 项目详情页应包含背景目标、源码范围、核心架构、执行链路、运行命令和边界说明。
- 首页和总览页只保留站内链接，避免读者从入口页跳转到失效资源。
- Mermaid 图用于解释架构、状态机和时序链路，文字说明仍应保留关键上下文。
