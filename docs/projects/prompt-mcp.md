# Prompt 管理 MCP 技术文档

## 1. 背景与目标

Prompt 管理 MCP 项目用于统一管理 prompt 数据，并同时向人类用户和大模型客户端暴露访问能力。项目提供 Web 管理页面、REST API 和 MCP 接口，支持通过浏览器创建 prompt，也支持 MCP Client 通过 prompts capability 或 tools capability 查询和读取 prompt 内容。

该项目包含两个实现包：

- `packages/mcp`：标准实现，服务端异步流程使用原生 `Promise` 和 `async/await`。
- `packages/mcp-with-my-promise`：实验实现，在应用构建和数据服务层接入自实现的 `@lark/promises-a-plus`。

两个包的业务功能基本一致，主要差异在异步抽象层。标准实现适合作为实际服务基线，自实现 Promise 版本用于验证自研 Promise 在 Koa、MongoDB 和 MCP 场景中的可用性。

核心目标如下：

- 使用单个 Node.js 服务同时提供 Web UI、REST API 和 MCP Streamable HTTP 接口。
- 使用 MongoDB 持久化 prompt 数据。
- 通过 REST API 支持 prompt 增删改查。
- 通过 MCP prompts capability 暴露 prompt 列表和指定 prompt 内容。
- 通过 MCP tools capability 暴露 `list_prompts` 和 `get_prompt` 工具。
- 通过 benchmark 脚本评估 prompt 列表读取接口的基础吞吐和延迟。

## 2. 项目范围

| 路径                                          | 说明                                                      |
| --------------------------------------------- | --------------------------------------------------------- |
| `packages/mcp/src/index.ts`                   | 标准版服务入口，加载环境变量并启动 Koa 服务               |
| `packages/mcp/src/app.ts`                     | 标准版 Koa 应用组装、MongoDB 连接、静态资源托管和路由注册 |
| `packages/mcp/src/routes/prompt-routes.ts`    | REST API 路由                                             |
| `packages/mcp/src/services/prompt-service.ts` | 标准版 Prompt 数据服务，使用原生 Promise                  |
| `packages/mcp/src/mcp.ts`                     | MCP Streamable HTTP 路由与 capability 注册                |
| `packages/mcp/src/client`                     | React 管理页面源码和 Rollup 构建配置                      |
| `packages/mcp/scripts/benchmark.ts`           | 标准版 benchmark 脚本                                     |
| `packages/mcp-with-my-promise`                | 接入自实现 Promise 的同构版本                             |

## 3. 技术栈

### 3.1 后端

| 技术                        | 用途                                         |
| --------------------------- | -------------------------------------------- |
| Koa                         | HTTP 服务框架                                |
| `@koa/router`               | REST API 和 MCP 路由管理                     |
| `@koa/bodyparser`           | JSON 请求体解析                              |
| `koa-static`                | 托管前端静态资源                             |
| MongoDB Node Driver         | 连接 MongoDB 并读写 prompt 数据              |
| `@modelcontextprotocol/sdk` | 注册 MCP Server 和 Streamable HTTP Transport |
| `@langchain/core/tools`     | 定义 MCP tools 背后的工具逻辑                |
| Zod                         | 定义工具入参 schema                          |
| dotenv                      | 加载环境变量                                 |

### 3.2 前端

| 技术                    | 用途           |
| ----------------------- | -------------- |
| React                   | Web 管理页面   |
| Rollup                  | 前端资源打包   |
| Babel / TypeScript 插件 | TSX 转译       |
| TailwindCSS / PostCSS   | 样式处理       |
| DaisyUI                 | UI 组件类名    |
| i18next / react-i18next | 中英文文案切换 |
| lucide-react            | 状态提示图标   |

### 3.3 工程工具

| 工具         | 用途                            |
| ------------ | ------------------------------- |
| concurrently | 同时启动服务端和前端 watch 构建 |
| tsx          | 开发环境直接运行 TypeScript     |
| tsc          | 服务端编译                      |
| autocannon   | HTTP 压测                       |
| Prettier     | 格式化                          |

## 4. 总体架构

```mermaid
flowchart TD
  User[浏览器用户] --> UI[React 管理页面]
  UI --> REST[REST API /prompts]

  McpClient[MCP Client / Agent] --> MCP[/mcp Streamable HTTP]
  MCP --> Transport[StreamableHTTPServerTransport]
  Transport --> Server[McpServer prompt-server]
  Server --> Prompts[Prompts Capability]
  Server --> Tools[Tools Capability]

  REST --> Service[PromptService]
  Prompts --> Service
  Tools --> Service
  Service --> Mongo[(MongoDB prompts 集合)]

  Koa[Koa 应用] --> UIStatic[koa-static 托管前端静态资源]
  Koa --> REST
  Koa --> MCP
```

系统运行在单个 Node.js 进程中。Koa 同时负责静态资源托管、REST API 和 MCP 接口，三类入口复用同一个 MongoDB 连接和 PromptService 数据访问逻辑。

## 5. 启动流程

```mermaid
sequenceDiagram
  participant Entry as src/index.ts
  participant Env as dotenv
  participant App as buildApp
  participant Mongo as MongoDB
  participant Koa as Koa App
  participant REST as Prompt Routes
  participant MCP as MCP Routes

  Entry->>Env: dotenv.config()
  Entry->>App: buildApp()
  App->>Mongo: new MongoClient(MONGO_URL)
  App->>Mongo: connect()
  Mongo-->>App: Db
  App->>Koa: app.context.db = db
  App->>Koa: bodyParser()
  App->>Koa: koa-static client
  App->>REST: setupPromptRoutes()
  App->>MCP: setupMcpRoutes()
  App-->>Entry: app
  Entry->>Koa: listen(PORT || 3000, 0.0.0.0)
```

默认 MongoDB 连接地址为：

```text
mongodb://root:pass@localhost:27017/db0?authSource=admin
```

可以通过 `MONGO_URL` 覆盖默认连接，通过 `PORT` 覆盖默认端口 `3000`。

## 6. 数据模型

Prompt 数据结构定义在 `src/types.ts`：

```ts
export interface Prompt {
  _id?: ObjectId;
  name: string;
  description: string;
  content: string;
  createdAt?: Date;
  updatedAt?: Date;
}
```

| 字段          | 说明                                         |
| ------------- | -------------------------------------------- |
| `_id`         | MongoDB ObjectId，由数据库生成               |
| `name`        | prompt 名称，用于展示和按名称查询            |
| `description` | prompt 描述，用于列表展示和 MCP prompts 描述 |
| `content`     | prompt 正文，用于 MCP 返回给模型             |
| `createdAt`   | 创建时间，由服务端写入                       |
| `updatedAt`   | 更新时间，由服务端写入                       |

集合名称固定为 `prompts`。`PromptService` 在构造时通过 `db.collection<Prompt>('prompts')` 获取集合引用。

## 7. 数据服务

标准版 `PromptService` 使用 MongoDB Driver 的原生 Promise API，提供以下方法：

| 方法                 | 行为                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `create(prompt)`     | 写入 prompt，补充 `createdAt` 和 `updatedAt`，返回带 `_id` 的对象 |
| `findAll()`          | 返回全部 prompt                                                   |
| `findById(id)`       | 校验 ObjectId 后按 `_id` 查询，非法 ID 返回 `null`                |
| `findByName(name)`   | 使用大小写不敏感正则按名称查询首个 prompt                         |
| `update(id, update)` | 校验 ObjectId 后更新字段和 `updatedAt`，返回更新后的对象          |
| `delete(id)`         | 校验 ObjectId 后删除记录，返回是否删除成功                        |

数据服务被 REST API 和 MCP 能力复用，确保 Web 管理页面写入的数据可以立即被 MCP Client 查询。

## 8. REST API

REST API 统一挂载在 `/prompts` 前缀下。

| 方法     | 路径           | 说明              | 成功响应         | 失败响应                                         |
| -------- | -------------- | ----------------- | ---------------- | ------------------------------------------------ |
| `GET`    | `/prompts`     | 查询 prompt 列表  | `Prompt[]`       | 依赖框架默认错误处理                             |
| `GET`    | `/prompts/:id` | 按 ID 查询 prompt | `Prompt`         | `404 { error: 'Prompt not found' }`              |
| `POST`   | `/prompts`     | 创建 prompt       | `201 Prompt`     | `400 { error: 'Name and content are required' }` |
| `PUT`    | `/prompts/:id` | 更新 prompt       | `Prompt`         | `404 { error: 'Prompt not found' }`              |
| `DELETE` | `/prompts/:id` | 删除 prompt       | `204 No Content` | `404 { error: 'Prompt not found' }`              |

创建接口要求 `name` 和 `content` 必填；`description` 在类型上是必填字段，但 REST 创建路由当前没有显式校验它。前端表单会将 `description` 作为必填输入提交。

## 9. Web 管理页面

Web 管理页面位于 `src/client`，入口为 `src/client/src/index.tsx`，核心表单为 `prompt-form.tsx`。

主要能力：

- 展示 Prompt 管理标题和说明。
- 支持中英文切换，默认语言为英文。
- 提供 `name`、`description`、`content` 三个输入项。
- 提交时向 `/prompts` 发起 `POST` 请求。
- 保存成功后清空表单并展示成功状态。
- 保存失败时展示后端错误或网络错误。

前端构建使用 Rollup：

```mermaid
flowchart LR
  TSX[src/index.tsx] --> Rollup[Rollup]
  Rollup --> Babel[Babel React / TypeScript]
  Rollup --> PostCSS[PostCSS / TailwindCSS / DaisyUI]
  Rollup --> JSON[i18n JSON]
  Babel --> JS[dist/bundle.js]
  PostCSS --> CSS[dist/bundle.css]
```

选择 Rollup 的原因是前端最终以静态资源形式由 Koa 托管。这样开发和部署时可以保持单个后端端口，同时提供管理页面、REST API 和 MCP 服务。

## 10. MCP 接口

MCP 接口挂载在 `/mcp`，使用 `StreamableHTTPServerTransport` 处理 MCP Client 请求。

### 10.1 Session 管理

`src/mcp.ts` 使用内存 Map 维护 session：

```ts
const transports = new Map<string, StreamableHTTPServerTransport>();
```

处理逻辑如下：

1. 请求头存在 `mcp-session-id` 时，尝试从 Map 中查找已有 transport。
2. 找不到对应 session 时返回 `404 Session not found`。
3. 请求头不存在 `mcp-session-id` 时，创建新的 `StreamableHTTPServerTransport`。
4. 新 session 初始化后创建 `McpServer` 并连接 transport。
5. transport 关闭时通过 `onclose` 删除 session 映射。

```mermaid
sequenceDiagram
  participant Client as MCP Client
  participant Route as /mcp route
  participant Map as transports Map
  participant Transport as StreamableHTTPServerTransport
  participant Server as McpServer

  Client->>Route: request without mcp-session-id
  Route->>Transport: create transport
  Transport->>Route: onsessioninitialized(sid)
  Route->>Server: create prompt-server
  Route->>Map: transports.set(sid, transport)
  Server->>Transport: connect(transport)
  Client->>Route: request with mcp-session-id
  Route->>Map: transports.get(sessionId)
  Map-->>Route: transport
  Route->>Transport: handleRequest(req, res, body)
  Transport-->>Map: onclose delete(sid)
```

### 10.2 Prompts Capability

服务端声明 prompts capability：

```ts
capabilities: {
  prompts: {},
  tools: {},
}
```

Prompts capability 注册两个请求处理器：

| MCP 请求                   | 实现                         | 返回                                                                |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| `ListPromptsRequestSchema` | 查询全部 prompt              | `{ prompts: [{ name, description }] }`                              |
| `GetPromptRequestSchema`   | 按 `params.name` 查询 prompt | `{ messages: [{ role: 'user', content: { type: 'text', text } }] }` |

`GetPrompt` 使用 `PromptService.findByName()` 查询。未找到时抛出 `Prompt ${promptName} not found`。

### 10.3 Tools Capability

Tools capability 暴露两个工具：

| 工具           | 入参               | 行为                     | 返回                        |
| -------------- | ------------------ | ------------------------ | --------------------------- |
| `list_prompts` | `{}`               | 查询全部 prompt 并序列化 | JSON 字符串                 |
| `get_prompt`   | `{ name: string }` | 按名称查询 prompt        | prompt content 或未找到提示 |

工具注册分两层：

- 使用 `@langchain/core/tools` 定义工具名称、描述和 Zod schema。
- 在 `ListToolsRequestSchema` 和 `CallToolRequestSchema` 中将工具转换为 MCP tools 列表和调用结果。

工具调用返回 MCP content 数组：

```ts
return {
  content: [{ type: "text", text: result }],
};
```

## 11. MCP 与 REST 的关系

```mermaid
flowchart LR
  Web[Web 管理页面] --> Post[POST /prompts]
  Post --> Store[(MongoDB prompts)]

  Agent[MCP Client] --> ListPrompts[ListPrompts]
  Agent --> GetPrompt[GetPrompt]
  Agent --> ListTools[list_prompts]
  Agent --> GetTool[get_prompt]

  ListPrompts --> Store
  GetPrompt --> Store
  ListTools --> Store
  GetTool --> Store
```

REST API 是 prompt 数据的管理入口，MCP 是 prompt 数据面向模型的消费入口。两者共享同一份 MongoDB 数据，不需要额外同步流程。

## 12. 双版本差异

| 维度     | `packages/mcp`                     | `packages/mcp-with-my-promise`            |
| -------- | ---------------------------------- | ----------------------------------------- |
| 业务功能 | Web UI、REST API、MCP、benchmark   | 与标准版一致                              |
| 前端源码 | React + Rollup                     | 与标准版一致                              |
| MCP 实现 | 原生 Promise / async handler       | 与标准版基本一致                          |
| 应用构建 | `buildApp(): Promise<AppInstance>` | `buildApp(): MyPromise<AppInstance>`      |
| 数据服务 | `async` 方法返回原生 `Promise`     | 手动包装 MongoDB Promise 为 `MyPromise`   |
| 额外依赖 | 无自研 Promise 依赖                | 依赖 `@lark/promises-a-plus`              |
| 适用目的 | 实际服务基线                       | 验证自实现 Promise 在服务端链路中的可用性 |

自实现 Promise 版本的典型改造点：

```ts
export const buildApp = (): MyPromise<AppInstance> => {
  return new MyPromise((resolve, reject) => {
    client.connect().then(
      () => {
        // 初始化 Koa、路由和 MongoDB context
        resolve(app);
      },
      (err) => reject(err),
    );
  });
};
```

数据服务层也将 MongoDB Driver 返回的原生 Promise 包装为 `MyPromise`：

```ts
findAll(): MyPromise<Prompt[]> {
  return new MyPromise((resolve, reject) => {
    this.collection.find().toArray().then(resolve, reject);
  });
}
```

## 13. Benchmark

两个包都提供 `scripts/benchmark.ts`，使用 `autocannon` 对 `GET /prompts` 做短连接 HTTP 压测。

压测参数：

| 参数        | 值         | 说明                                                    |
| ----------- | ---------- | ------------------------------------------------------- |
| URL         | `/prompts` | prompt 列表读取接口，benchmark 脚本在本地 3000 端口访问 |
| connections | `10`       | 并发连接数                                              |
| pipelining  | `1`        | 每个连接上的流水线请求数                                |
| duration    | `10`       | 压测时长，单位秒                                        |

选择只压测 `GET /prompts` 的原因：

- `POST`、`PUT`、`DELETE` 会产生数据库写入副作用，容易制造脏数据。
- `/mcp` 是会话化 Streamable HTTP 接口，不适合作为普通短连接接口压测。
- prompt 列表读取是管理应用的基础读路径，可以反映 Koa、MongoDB 和网络 I/O 的基准性能。

benchmark 结束后脚本会关闭 HTTP server 和 MongoDB client，避免进程悬挂。

## 14. 构建与运行

### 14.1 标准版

```bash
pnpm --filter @lark/mcp dev
pnpm --filter @lark/mcp build
pnpm --filter @lark/mcp start
pnpm --filter @lark/mcp benchmark
```

### 14.2 自实现 Promise 版

```bash
pnpm --filter @lark/mcp-with-my-promise dev
pnpm --filter @lark/mcp-with-my-promise build
pnpm --filter @lark/mcp-with-my-promise start
pnpm --filter @lark/mcp-with-my-promise benchmark
```

### 14.3 脚本说明

| 脚本         | 行为                                    |
| ------------ | --------------------------------------- |
| `dev`        | 同时运行 `dev:server` 和 `dev:client`   |
| `dev:server` | 使用 `tsx src/index.ts` 启动服务端      |
| `dev:client` | 进入 `src/client` 并执行 Rollup watch   |
| `build`      | 并行执行服务端 `tsc` 和前端 Rollup 构建 |
| `start`      | 先构建，再执行 `node dist/index.js`     |
| `benchmark`  | 启动临时服务并压测 `/prompts`           |
| `format`     | 使用 Prettier 格式化当前包              |

## 15. 配置项

| 配置        | 默认值                                                     | 说明              |
| ----------- | ---------------------------------------------------------- | ----------------- |
| `PORT`      | `3000`                                                     | HTTP 服务监听端口 |
| `MONGO_URL` | `mongodb://root:pass@localhost:27017/db0?authSource=admin` | MongoDB 连接地址  |

部署或本地运行前需要确保 MongoDB 可连接。benchmark 脚本同样依赖 MongoDB 正常运行。

## 16. 边界与注意事项

### 16.1 会话存储是内存态

MCP transport session 存储在进程内 Map 中。服务重启后 session 会丢失，多进程或多实例部署时也无法共享 session。若要部署到多副本环境，需要引入粘性会话或外部 session 存储。

### 16.2 REST 缺少统一错误处理中间件

当前 REST 路由对常见业务错误做了局部处理，例如 400 和 404。但数据库异常、未知异常等仍依赖 Koa 默认行为。生产化时建议增加统一错误处理中间件和结构化日志。

### 16.3 Prompt 名称查询是模糊匹配

`findByName()` 使用 MongoDB 正则和 `i` 选项执行大小写不敏感模糊匹配。这样便于模型按名称查找，但当多个 prompt 名称相近时，可能返回第一个匹配项。生产化时建议增加唯一索引或改为精确匹配。

### 16.4 创建接口校验较轻

`POST /prompts` 当前只校验 `name` 和 `content`，没有统一使用 Zod 校验 REST 入参，也没有限制字段长度。生产化时建议补充 schema 校验、长度限制和内容安全策略。

### 16.5 自实现 Promise 版本适合验证，不宜直接作为基线替代

`mcp-with-my-promise` 的价值在于验证自实现 Promise 与真实服务链路的兼容性。若要用于生产基线，需要先补充更完整的稳定性测试、异常传播测试和性能对比。

### 16.6 包描述与实际技术栈不完全一致

两个包的 `package.json` description 提到 Fastify，但实际实现使用 Koa。文档以代码实现为准。

## 17. 后续优化方向

- 增加统一错误处理中间件，标准化 REST 和 MCP 错误响应。
- 为 REST 入参补充 Zod schema 校验，并统一 `Prompt` 的必填字段约束。
- 为 `name` 建立唯一索引或明确模糊匹配策略。
- 将 MCP session 存储从内存 Map 抽象为可替换存储，支持多实例部署。
- 增加 REST API 和 MCP 请求处理器的自动化测试。
- 增加标准版与自实现 Promise 版的 benchmark 对比报告。
- 补充前端列表、编辑和删除能力，使 Web 管理页面覆盖完整 CRUD。
