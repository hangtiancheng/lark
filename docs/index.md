---
layout: home

hero:
  name: hangtiancheng/lark
  text: 前端工程实践文档
  tagline: 汇总工程化、运行时、跨端、数据服务与业务组件实践，提供项目摘要、源码定位和运行命令。
  actions:
    - theme: brand
      text: 项目摘要
      link: /guide/overview
    - theme: alt
      text: 命令手册
      link: /guide/commands
    - theme: alt
      text: 全局搜索框
      link: /projects/global-search

features:
  - title: 项目摘要
    details: 按项目说明定位、源码范围、核心能力和推荐阅读路径，适合首次了解仓库全貌。
    link: /guide/overview
  - title: 命令手册
    details: 按项目列出 npm scripts、pnpm 执行方式和使用场景，适合开发、构建、测试和预览时查阅。
    link: /guide/commands
  - title: 项目详情
    details: 每个项目文档都补充架构图、执行链路、核心实现、接入方式、边界说明和后续优化方向。
    link: /projects/conditional-bundle-plugin
---

## 项目索引

| 项目         | 技术主题                                   | 源码范围                                        | 文档                                        |
| ------------ | ------------------------------------------ | ----------------------------------------------- | ------------------------------------------- |
| 条件编译插件 | 多构建器适配、源码裁剪、路由裁剪           | `conditional-bundle-plugin`、React / Vue 示例   | [查看](/projects/conditional-bundle-plugin) |
| JS 金融计算  | `bigint` 金额精度、折扣计算、格式化        | `packages/math`                                 | [查看](/projects/js-finance)                |
| Promise      | Promise A+、thenable 解析、静态方法        | `packages/promises-a-plus`                      | [查看](/projects/promise)                   |
| Prompt MCP   | Koa、MongoDB、MCP prompts / tools          | `packages/mcp`、`packages/mcp-with-my-promise`  | [查看](/projects/prompt-mcp)                |
| 网络检测工具 | 网络诊断 SDK、订阅机制、React 面板         | `packages/network`                              | [查看](/projects/network)                   |
| Mini Vue     | Proxy 响应式、模板编译、批处理更新         | `packages/not-vue`                              | [查看](/projects/mini-vue)                  |
| 番茄钟       | ReactLynx、Rspeedy、跨端计时应用           | `packages/pomodoro`                             | [查看](/projects/pomodoro)                  |
| 全局搜索框   | React 中复用 Vue Composition API、搜索缓存 | `packages/react-vue`、`packages/react-vue-demo` | [查看](/projects/global-search)             |

## 快速入口

- 想了解项目全貌：阅读 [项目摘要](/guide/overview)。
- 想运行、构建或测试：阅读 [命令手册](/guide/commands)。
- 关注构建工程化：从 [条件编译插件](/projects/conditional-bundle-plugin) 开始。
- 关注运行时原理：依次阅读 [Promise](/projects/promise)、[Mini Vue](/projects/mini-vue)、[全局搜索框](/projects/global-search)。
- 关注业务与服务实践：阅读 [网络检测工具](/projects/network)、[Prompt MCP](/projects/prompt-mcp)、[番茄钟](/projects/pomodoro)。
