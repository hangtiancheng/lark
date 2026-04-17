Prompt Manager 是一个基于模型上下文协议 (Model Context Protocol, MCP) 的提示词管理应用，提供两类能力

1. 面向用户的 Web 管理页面，方便增删改查提示词
2. 面向大模型的 MCP 接口

## 前后端架构

- 前端使用 react, 使用 rollup 打包，输出静态资源到 @/client/dist 目录，包括 @/client/dist/bundle.js 和 @/client/dist/bundle.css
- 后端使用 koa, 使用 koa-static 直接托管 @/client/client 静态资源目录
- 结论: 后端 API 和前端 UI 运行在相同 node 进程和相同端口 3000, 提供 RESTful API + MCP 服务 + 管理页面

## 核心技术栈

### 后端

后端提供 RESTful API 与 MCP 接口

- Koa.js
  - 路由: @koa/router
  - 请求体解析: @koa/bodyparser
  - 托管静态资源目录: koa-static
- MongoDB
- Model Context Protocol SDK (@modelcontextprotocol/sdk)
  - 提供 MCP 接口
  - 使用 StreamableHTTPServerTransport实现 SSE 流式响应
  - 通过内存 map 维护 sessionId => transport 的映射, 支持多 session
- LangChain Core (@langchain/core)
  - 提供 tool 工具调用: list_prompts 和 get_prompt
- Zod
  - 工具参数 schema 校验
- Concurrrently
  - 方便开发, 同时打包前端 cd src/client && rollup -c -w 和运行后端 tsx src/index.ts

### 前端

- React
- Rollup
- Tailwindcss + PostCSS
- DaisyUI https://daisyui.com/ daisyUI 是我很喜欢的 Tailwind CSS 插件, 提供了有用的组件类名
- i18next + react-i18next

## 性能测试

Autocannon: 高性能的 Node.js 压测工具, 用于测量系统的吞吐量和延迟

### 压测范围说明

- 为什么不压测所有 API (例如 POST/PUT/DELETE 和 MCP SSE 接口)
  - 副作用和脏数据: POST/PUT/DELETE 是有副作用的接口 (数据库写操作), 如果使用压测，会在数据库中产生海量脏数据, 干扰后续的查询测试，并且需要引入复杂的数据清理 (Teardown)
  - SSE 长连接: `/mcp` 接口基于 Server-Sent Events (SSE) 长连接, Autocannon 用于短连接 HTTP 请求/响应周期压测
  - 核心瓶颈: 管理应用中, 读操作 (GET) 占据大部分流量, 压测读 prompt 列表接口 `http://localhost:3000/prompts`, 可以有效测量网络 I/O、Koa 框架、MongoDB 读性能, 可以反映基准 I/O 性能
- 创建 10 个连接 (connections), 压测 10 秒 (duration), 使用 `autocannon.track` 渲染进度条
  - Requests/sec (QPS): 每秒处理的请求数
  - Latency (延迟): 请求响应时间 (ms)
  - Throughput (吞吐量): 每秒传输的字节数 (MB/s)

### 结论

- 10 个并发连接, 压测 10 秒, 每秒处理 8,199 个请求, Koa 服务表现出高吞吐和低延迟
  - Requests/sec (QPS): 每秒平均处理约 8k 个请求, 10 秒一共处理约 82k 个请求
  - Latency (延迟): 平均延迟约 1ms
  - Throughput (吞吐量): 每秒传输数据约 14.3 MB, 10 秒内一共传输约 143 MB 数据
- Stat 表格每一列含义
  - 2.5% / 50% / 97.5% / 99%: 分位数 (percentile), 例如 50% 表示一半的请求低于该值, 99% 表示 99% 的请求低于该值, 用于观察长尾延迟与性能稳定性
  - Avg / Max / Min: 平均值, 最大值, 最小值
  - Stdev: 标准差, 评估性能稳定性, 数值越小表示性能抖动越小

## 为什么不使用 vite 而使用 rollup

- 觉得「使用 rollup 打包，输出静态资源; 后端使用 koa 托管静态资源目录」可能比较有趣, 想试试
- 如果使用 vite, 开发时同时有一个 vite 开发服务器和 一个 koa 服务
- 只需要运行 koa 服务，一个 3000 端口可以同时提供 mcp 接口和前端 UI
- rollup 的 `-w` 可以监听文件变化并自动重新构建 bundle, 开发体验也不错
