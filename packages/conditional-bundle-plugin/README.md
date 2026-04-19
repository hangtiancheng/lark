# @lark/conditional-bundle-plugin

`@lark/conditional-bundle-plugin` 是一个面向前端工程的条件编译插件集合，用于在打包阶段删除不满足条件的源码分支，从而替代运行时 `if / else`、三元表达式和大量环境判断。

它的设计目标不是“定义常量替换”，而是“在源码层做结构化裁剪”：

- 允许在路由、配置对象、复杂组件分支中直接写条件编译指令
- 在进入 bundler 后尽早删除不需要的源码
- 减少运行时代码体积、条件分支复杂度和无效依赖
- 统一支持多种构建工具，尽量复用同一套核心算法

目前仓库中已经实现并导出的版本包括：

- `vite`
- `rollup`
- `esbuild`
- `rsbuild`
- `webpack`

## 背景

日常开发中，经常会出现类似如下逻辑：

```ts
if (env === "dev") {
  doSomething();
}

if (app === "xxx") {
  doSomething();
} else {
  doSomethingElse();
}
```

或者：

```ts
const config = {
  aaa: 1,
  bbb: env === "dev" ? "x" : "y",
};
```

这种方案存在两个典型问题：

- 运行时仍然保留分支，最终会增加包体
- 当分支出现在路由表、对象字面量、复杂 JSX/Vue 模板附近时，可读性会快速下降

因此这里采用了“注释指令 + 打包期裁剪”的方式：

```ts
// #if MY_ENV == 'dev' && app == '1'
const a = 1;
// #elif MY_ENV == 'test'
const a = 2;
// #else
const a = 3;
// #endif
```

最终只保留满足条件的源码，其余内容会在打包阶段被移除。

## 功能矩阵

| 目录          | 作用                                             | 当前状态 |
| ------------- | ------------------------------------------------ | -------- |
| `src/core`    | 核心算法：文件过滤、指令识别、条件求值、源码裁剪 | 已实现   |
| `src/vite`    | Vite 条件编译插件                                | 已实现   |
| `src/rollup`  | Rollup 条件编译插件                              | 已实现   |
| `src/esbuild` | esbuild 条件编译插件（TS 版本）                  | 已实现   |
| `src/rsbuild` | Rsbuild 条件编译插件                             | 已实现   |
| `src/webpack` | Webpack 条件编译插件与 loader 适配               | 已实现   |

## 仓库结构概览

除了 `src` 目录中的源码实现，包根目录还承担了构建与分发职责：

- `package.json`：声明对外导出入口、peerDependencies 和构建脚本
- `rollup.config.js`：将 `src/core`、`src/vite`、`src/rollup`、`src/esbuild`、`src/rsbuild`、`src/webpack` 打成可发布产物
- `tsconfig.json`：约束源码与产物的类型边界
- `README.md`：作为插件能力、原理和接入方式的统一技术说明

可以把整个包简单理解为两层：

- `src/core`：条件编译引擎
- `src/*` 其余目录：不同 bundler 的接入适配层

## 目录说明

### `src/core`

`src/core/index.ts` 是整个插件包最核心的部分。所有 TS 版本的 bundler 适配层都尽量复用这里的能力。

它主要负责 4 件事：

- 定义插件配置接口 `ConditionalBundleOptions`
- 根据 `includes` / `excludes` 生成文件过滤器
- 识别 `#if / #elif / #else / #endif` 指令
- 根据传入的变量表，把源码裁剪成最终内容

核心导出包括：

- `createFilter()`
- `normalizeFileId()`
- `hasConditionalDirective()`
- `transformConditional()`
- `transformConditionalSource()`

### `src/vite`

`src/vite/index.ts` 是 Vite 适配层。

实现特点：

- 通过 Vite 的 `transform` 钩子处理源码
- 先使用 `createFilter()` 判断文件是否需要参与条件编译
- 再调用 `transformConditionalSource()` 做真实裁剪
- 插件设置为 `enforce: "pre"`，尽量在其他编译步骤之前执行

这是最薄的一层封装，几乎不重复核心逻辑。

### `src/rollup`

`src/rollup/index.ts` 是 Rollup 适配层。

实现方式和 Vite 很接近：

- 使用 Rollup 的 `transform()` 钩子
- 只负责做 bundler 层适配
- 真实裁剪全部交给 `core`

因为 Vite 底层就基于 Rollup 插件模型，所以这一层非常轻。

### `src/esbuild`

`src/esbuild/index.ts` 是 esbuild 的 TS 版本插件。

实现特点：

- 使用 `build.onLoad()` 拦截文件读取
- 在读取到文件源码后执行条件编译
- 根据扩展名推断 `loader`
- 返回裁剪后的 `contents`

这里和 Vite / Rollup 的最大差异在于：

- Vite / Rollup 是拿到已有源码后做 `transform`
- esbuild 插件更像是“在 onLoad 阶段重写模块内容”

### `src/rsbuild`

`src/rsbuild/index.ts` 是 Rsbuild 适配层。

实现方式：

- 使用 `api.transform()` 注入源码变换
- 只匹配 `ts / tsx / js / jsx` 之类的脚本资源
- 避免误处理 HTML 等非源码资源

这层的关键点是：

- Rsbuild 本身封装在 Rspack 之上
- 插件需要遵循 Rsbuild 的 transform API，而不是直接写 Webpack loader

### `src/webpack`

`src/webpack` 包含两个文件：

- `index.ts`
- `loader.ts`

其中：

- `loader.ts` 是真正执行源码条件编译的 Webpack loader
- `index.ts` 是 Webpack 插件，用于把这个 loader 注入到构建流程里

Webpack 这一套比其他 bundler 稍重，因为它不是单纯的 `transform()` 风格接口，而是显式地走 loader 链。

## 插件配置

所有 TS 版本适配层共享同一个配置结构：

```ts
interface ConditionalBundleOptions {
  includes?: string[];
  excludes?: string[];
  vars?: Record<string, unknown>;
}
```

### `includes`

指定哪些文件参与条件编译。

例如：

```ts
includes: ["**/*.ts", "**/*.tsx", "**/*.vue"];
```

### `excludes`

指定哪些文件显式跳过条件编译。

例如：

```ts
excludes: ["**/*.test.*", "**/node_modules/**"];
```

### `vars`

条件表达式中可用的变量表。

例如：

```ts
vars: {
  MY_ENV: process.env.MY_ENV || 'prod',
  app: process.env.app || '1',
  ROUTE_DASHBOARD: true,
}
```

## 条件编译语法

当前支持 4 个指令：

- `#if`
- `#elif`
- `#else`
- `#endif`

示例：

```ts
// #if ROUTE_DASHBOARD
const DashboardMain = React.lazy(
  () => import("@/pages/dashboard/dashboard-main"),
);
// #elif ROUTE_MAIN
const MainPage = React.lazy(() => import("@/pages/main/fe-main"));
// #else
const EmptyPage = React.lazy(() => import("@/pages/empty-main"));
// #endif
```

也支持嵌套：

```ts
// #if MY_ENV == 'prod'
const mode = "prod";
// #if app == '1'
const appName = "main";
// #else
const appName = "other";
// #endif
// #endif
```

## 技术原理

### 1. 文件过滤

首先通过 `createFilter()` 判断一个文件是否需要参与条件编译。

过滤逻辑不是简单地拿绝对路径做 glob 匹配，而是同时尝试多个候选：

- 绝对路径
- 相对 `cwd` 的路径
- basename

这样能兼容：

- `src/*.ts`
- `**/*.tsx`
- 不同 bundler 传入的资源路径形式

同时还会自动排除：

- `node_modules`
- 以 `\0` 开头的内部虚拟模块

### 2. 快速跳过无指令文件

`hasConditionalDirective()` 会先做一次快速检测。

如果源码中完全不包含：

- `#if`
- `#elif`
- `#else`
- `#endif`

则直接返回 `null`，避免无意义解析。

这样做的原因是：

- 大部分源码文件不包含条件编译指令
- 快速判断可以减少 transform 开销
- 对大项目启动性能更友好

### 3. 指令解析

核心解析逻辑基于逐行扫描。

在 TS 版中：

- 使用正则识别一行是否为 `#if / #elif / #else / #endif`
- 维护一个栈来描述当前分支激活状态

### 4. 条件求值

在 TS 版中，条件表达式会根据传入的 `vars` 求值。

这意味着支持如下条件：

```ts
MY_ENV == "dev" && app == "1";
```

### 5. 源码裁剪

一旦某个分支不满足条件：

- 指令行本身会被移除
- 对应分支内的源码也会被移除

最终保留下来的源码是一个合法的、已经消除无关分支的文件。

TS 版使用 `magic-string` 生成最终结果和 sourcemap：

- 方便与 bundler 的后续 sourcemap 合并
- 避免粗暴字符串替换导致位置信息丢失

### 6. 错误处理

插件会显式检查一些非法写法：

- `#elif` 前面没有 `#if`
- `#else` 前面没有 `#if`
- `#endif` 前面没有 `#if`
- 文件结束后仍有未闭合的 `#if`

TS 版也有相同语义的保护逻辑。

### 7. 一次完整处理链路

从 bundler 视角看，一次条件编译大致会经过如下步骤：

1. bundler 将模块源码交给对应适配层
2. 适配层使用 `createFilter()` 判断当前文件是否参与条件编译
3. 如果文件中不存在 `#if / #elif / #else / #endif`，直接跳过
4. 如果存在指令，则进入 `transformConditionalSource()`
5. 核心层按行扫描源码，维护分支栈并判断当前代码块是否应保留
6. 使用 `magic-string` 产出新代码和 sourcemap
7. bundler 继续处理裁剪后的源码，后续 tree-shaking 和 chunk splitting 自然生效

这个链路有一个很重要的副作用收益：

- 条件编译不是最终优化手段，而是给后续 bundler 优化创造更干净的输入

例如一个被裁掉的动态 import 不再存在后，后续页面 chunk 也不会继续参与构建与输出。

## 为什么不做 AST 级条件裁剪

这个插件采用的是“行级指令 + 源码裁剪”，而不是 JS AST 级 `if` 分析。

这样做有几个实际好处：

- 可跨语言使用，不只限于 JS / TS 表达式树
- 更适合路由表、对象配置、动态 import、Vue SFC 附近的源码组织
- 对 bundler 接入更轻，不依赖 Babel / SWC / TypeScript AST

代价也很明确：

- 指令必须独立成行
- 它不理解语义，只理解指令块边界
- 对错误嵌套和格式问题更依赖规范书写

## 技术问题与设计取舍

### 1. 为什么使用注释指令而不是运行时常量替换

常量替换更适合：

- `if (__DEV__) { ... }`
- `if (import.meta.env.MODE === 'development') { ... }`

但当条件分支出现在如下位置时就不够自然：

- 路由表
- 大型对象字面量
- Vue / React 懒加载导入列表
- 很多彼此排斥的页面注册逻辑

注释指令能更直接表达“这一大段代码要不要保留”。

### 2. 为什么核心逻辑要独立在 `core`

如果每个 bundler 都自己实现条件编译，会带来几个问题：

- 功能行为不一致
- bug 修复需要多处同步
- 路径匹配和错误处理容易漂移

所以这里把核心能力抽到了 `src/core`，bundler 层只负责：

- 接入对应构建钩子
- 提供源码
- 接收裁剪结果

### 3. 为什么 `createFilter()` 要支持绝对路径和相对路径

不同 bundler 对模块 ID 的处理不同：

- Webpack loader 常拿到绝对路径
- Rollup / Vite transform 可能带 query
- esbuild `args.path` 是文件路径
- 某些场景下用户只写 `src/*.ts`

因此过滤器必须兼容多种路径表示方式，否则 `includes` 很容易在某些 bundler 下失效。

### 4. 为什么 Rsbuild 只匹配脚本资源

在实际集成中，如果把 transform 范围写成 `/.*/`，可能会把：

- `html`
- 非脚本资源
- bundler 内部产物

也送进条件编译流程，最终导致解析错误。

因此 `rsbuild` 版本现在显式只处理脚本资源。

### 5. 为什么不同 bundler 仍然要保留独立目录

虽然核心逻辑统一在 `src/core`，但不同 bundler 的接入点完全不同：

- Vite / Rollup：`transform`
- Webpack：loader 链
- esbuild：`onLoad`
- Rsbuild：`api.transform`

如果为了“目录更少”而强行把所有适配写进一个文件，会导致：

- 接口语义混杂
- 平台差异难以维护
- 调试时无法快速定位到具体 bundler 适配实现

因此当前目录设计是有意为之：核心统一、接入分离。

## 对外导出

当前 `package.json` 已导出如下入口：

```json
{
  ".": "./dist/core/index.js",
  "./vite": "./dist/vite/index.js",
  "./rollup": "./dist/rollup/index.js",
  "./esbuild": "./dist/esbuild/index.js",
  "./rsbuild": "./dist/rsbuild/index.js",
  "./webpack": "./dist/webpack/index.js"
}
```

因此使用方式通常是：

```ts
import ViteConditionalBundlePlugin from "@lark/conditional-bundle-plugin/vite";
import RollupConditionalBundlePlugin from "@lark/conditional-bundle-plugin/rollup";
import EsbuildConditionalBundlePlugin from "@lark/conditional-bundle-plugin/esbuild";
import RsbuildConditionalBundlePlugin from "@lark/conditional-bundle-plugin/rsbuild";
import WebpackConditionalBundlePlugin from "@lark/conditional-bundle-plugin/webpack";
```

## 实际接入示例

### 示例工程总览

当前仓库中有两个真实接入工程：

- `fe24-client`：React + Webpack 主工程，同时补充了 `webpack / rsbuild / esbuild / rollup` 四套条件编译接入
- `fe24-client-vue`：Vue + Vite 工程，接入 `vite` 条件编译插件

这两个项目一起验证了本插件的几个关键能力：

- React 路由表裁剪
- Vue 路由表裁剪
- 多 bundler 共享同一套路由条件变量
- 通过 `SELECTED_ROUTES` 控制最终参与编译的页面集合

### 1. `fe24-client` 中的 Webpack 接入

`/Users/bytedance/github/lark/packages/fe24-client/webpack.config.ts` 已接入 Webpack 条件编译插件。

关键配置：

```ts
new WebpackConditionalBundlePlugin({
  includes: ["**/*.ts", "**/*.tsx"],
  vars: createConditionalVars(routeFlags),
});
```

其中 `routeFlags` 由 `shared.js` 动态生成，例如：

- `ROUTE_DASHBOARD`
- `ROUTE_MAIN`
- `ROUTE_MAIN_GRID`
- `ROUTE_MAP`
- `ROUTE_ORDER`
- `ROUTE_ORDER_DETAIL`

`shared.js` 在这个工程里承担的是“条件变量编排中心”的职责：

- 读取 `.env` / `.env.{mode}`
- 读取或交互生成 `SELECTED_ROUTES`
- 生成 `routeFlags`
- 组装 `createConditionalVars()` 和 `createClientEnv()`

也就是说，Webpack、Rsbuild、esbuild、Rollup 四套构建配置虽然接入方式不同，但条件变量来源是一致的。

### 2. `fe24-client` 中的 Rsbuild 接入

`/Users/bytedance/github/lark/packages/fe24-client/rsbuild.config.ts` 已接入 Rsbuild 条件编译插件。

关键配置：

```ts
RsbuildConditionalBundlePlugin({
  includes: ["**/*.ts", "**/*.tsx"],
  vars: createConditionalVars(routeFlags),
});
```

同时它和 Webpack 一样，依赖 `shared.js` 中的路由选择逻辑。

Rsbuild 这套接入还有一个实际工程意义：

- 保持 React 工程在 Rspack 生态中也能使用和 Webpack 一致的条件编译策略
- 便于对比不同 bundler 下同一套路由裁剪策略的行为是否一致

### 3. `fe24-client` 中的 esbuild 接入

`/Users/bytedance/github/lark/packages/fe24-client/esbuild.config.js` 已接入 esbuild 条件编译插件。

关键配置：

```js
EsbuildConditionalBundlePlugin({
  includes: ["**/*.ts", "**/*.tsx"],
  vars: createConditionalVars(routeFlags),
});
```

构建命令示例：

```bash
SELECTED_ROUTES=dashboard pnpm build:esbuild
```

在这个场景下，未选中的页面 chunk 不会进入最终产物。

这一点非常适合做“快速实验性打包”：

- esbuild 构建速度快
- 条件编译后输入更少
- 对验证路由裁剪收益非常直接

### 4. `fe24-client` 中的 Rollup 接入

`/Users/bytedance/github/lark/packages/fe24-client/rollup.config.js` 已接入 Rollup 条件编译插件。

关键配置：

```js
RollupConditionalBundlePlugin({
  includes: ["**/*.ts", "**/*.tsx"],
  vars: createConditionalVars(routeFlags),
});
```

构建命令示例：

```bash
SELECTED_ROUTES=dashboard pnpm build:rollup
```

Rollup 的接入价值更多体现在“构建模型验证”：

- 它和 Vite 的插件模型接近
- 可以证明 `src/core` 的能力并不依赖某一个具体 bundler
- 也适合作为产物结构、chunk 行为的对照组

### 5. `fe24-client-vue` 中的 Vite 接入

`/Users/bytedance/github/lark/packages/fe24-client-vue/vite.config.ts` 已接入 Vite 条件编译插件。

关键配置：

```ts
ViteConditionalBundlePlugin({
  includes: ["**/*.ts", "**/*.tsx", "**/*.vue"],
  vars: {
    MY_ENV: process.env.MY_ENV || "prod",
    app: process.env.app || "1",
    ...activeRoutes,
  },
});
```

这里额外包含了 `**/*.vue`，因为 Vue 项目中的条件编译不仅应用在 TS 文件，也可能应用在 SFC 相关逻辑附近。

另外，`fe24-client-vue/vite.config.ts` 的实现也说明了一个实践点：

- 条件编译变量并不一定只能来自 `.env`
- 完全可以在构建启动时通过交互式选择产生一组路由 flag
- 然后再把这些 flag 交给条件编译插件完成源码裁剪

## 路由裁剪的真实使用方式

在两个示例工程中，条件编译最典型的实际用途是“按路由裁剪页面”。

React 项目 `fe24-client` 的 [routes.tsx](file:///Users/bytedance/github/lark/packages/fe24-client/src/router/routes.tsx) 中存在如下代码：

```ts
// #if ROUTE_DASHBOARD
const DashboardMain = React.lazy(
  () => import("@/pages/dashboard/dashboard-main"),
);
// #endif
// #if ROUTE_MAIN
const FeMain = React.lazy(() => import("@/pages/main/fe-main"));
// #endif
```

Vue 项目 `fe24-client-vue` 的 [routes.ts](file:///Users/bytedance/github/lark/packages/fe24-client-vue/src/router/routes.ts) 中存在对应的 Vue 版本：

```ts
// #if ROUTE_DASHBOARD
{
  path: '/dashboard',
  component: () => import('@/pages/dashboard/dashboard-main.vue'),
}
// #endif
```

这样做的直接收益是：

- 只打包当前需要调试的路由
- 其余页面不会进入产物
- 启动和增量编译时需要处理的模块更少

这也是条件编译插件在本仓库中的一个最重要业务价值。

## 从零接入指南

如果要在一个新的工程中接入本插件，建议按下面的步骤进行。

### 1. 先选择需要的 bundler 版本

例如：

```ts
import ConditionalBundlePlugin from "@lark/conditional-bundle-plugin/webpack";
```

或：

```ts
import ConditionalBundlePlugin from "@lark/conditional-bundle-plugin/vite";
```

### 2. 定义统一的条件变量

最少建议集中定义以下两类变量：

- 环境变量，例如 `MY_ENV`、`app`
- 业务开关，例如 `ROUTE_DASHBOARD`

示例：

```ts
const vars = {
  MY_ENV: process.env.MY_ENV || "prod",
  app: process.env.app || "1",
  ROUTE_DASHBOARD: true,
  ROUTE_MAIN: false,
};
```

### 3. 配置 `includes`

不同项目建议值如下：

- React / TS 项目：`['**/*.ts', '**/*.tsx']`
- Vue 项目：`['**/*.ts', '**/*.tsx', '**/*.vue']`

### 4. 在源码中逐步引入条件编译指令

推荐优先改造下面几类文件：

- 路由注册文件
- 大型页面懒加载入口
- 明显互斥的配置对象
- 与特定环境强绑定的注册逻辑

### 5. 验证产物

接入完成后，不要只看“是否构建成功”，还应重点检查：

- 未选中的页面是否仍然出现在 chunk 中
- 动态 import 是否被消除
- 产物体积是否下降
- sourcemap 是否仍可用

## 常见问题

### 1. 为什么配置里明明传了 `false`，源码仍然保留

这里不是简单的常量替换，而是条件表达式求值。只有当 `#if` 表达式整体求值为真时，对应代码块才会保留。

例如：

```ts
// #if ROUTE_MAIN
```

如果 `ROUTE_MAIN` 为 `false`，整个块会被移除。

### 2. 为什么 `includes: ['src/*.ts']` 有时也能匹配到绝对路径文件

因为 `createFilter()` 会同时尝试：

- 原始模块 ID
- 相对 `cwd` 的路径
- basename

这是为了兼容不同 bundler 的资源路径表示方式。

### 3. 条件编译之后为什么还需要 tree-shaking

条件编译只负责删掉“明确不该保留的源码块”，但一个代码块删除后，仍然可能留下：

- 未被继续引用的 import
- 空对象分支
- 冗余 helper

这些工作仍然需要由 bundler 的后续优化步骤来完成。

### 4. 适不适合拿来替换所有环境判断

不建议。

更推荐把它用于：

- 大块互斥代码
- 路由和页面注册
- 明确只在某环境/某应用启用的功能入口

而简单的运行时布尔判断，仍然可以继续使用普通代码表达。

## 推荐使用姿势

### 1. 指令尽量独立占行

推荐：

```ts
// #if ROUTE_ORDER
const OrderMain = React.lazy(() => import("@/pages/order/order-main"));
// #endif
```

不推荐把指令和业务代码混写在同一行。

### 2. `vars` 尽量集中构造

建议把环境变量和业务开关统一在配置层构造后传入插件，而不是在多个 bundler 配置里重复拼装。

例如 `fe24-client/shared.js` 就承担了这个职责。

### 3. 路由型条件编译建议配合统一 flag 命名

例如：

- `ROUTE_DASHBOARD`
- `ROUTE_MAIN`
- `ROUTE_MAP`

这样在不同 bundler 下的配置和源码都更容易对齐。

## 已知限制

当前实现有以下边界：

- 指令必须独立成行
- 主要面向脚本源码，不是通用模板 AST 编译器
- 依赖调用方传入正确的 `vars`
- 条件表达式能力受求值实现约束，不建议写过于复杂的表达式
- 它不会自动推导“业务上等价”的分支，只会严格按指令块裁剪
- 如果同一份源码被多个 bundler 使用，必须保证各 bundler 配置的 `vars` 一致

## 总结

这个插件包的核心思想非常明确：

- 用一套共享的条件编译核心算法
- 适配多个 bundler 的不同源码变换入口
- 把运行时分支问题提前到打包阶段解决
- 在真实业务中优先服务“按路由裁剪页面”和“按环境裁剪功能”的场景

如果只看实现结构，可以把它理解为：

- `src/core`：条件编译引擎
- `src/*` 各目录：对应 bundler 的接入层
- `fe24-client` / `fe24-client-vue`：真实业务接入样例

这使得它既可以作为一个独立技术方案复用，也可以作为业务工程的构建优化基础设施持续演进。
