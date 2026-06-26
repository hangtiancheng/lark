# lark-mvc 函数式重写 CR — 缺陷与功能缺失清单

> 对比 `alpha/functional-rewrite` 与 `origin/main` 的 `packages/lark-mvc` 子包

## 一、严重功能缺陷（P0）

### 1. Hooks 系统完全失效

- **位置**: `src/hooks.ts` + `src/view.ts`
- **问题**: `setCurrentCtx()` 已定义但**从未被调用**。`mountCtx()` 在执行 setup 函数前未调用 `setCurrentCtx(ctx)`，导致 `currentCtx` 始终为 `null`，所有 hooks（`useState`、`useEffect`、`useStore`、`useInterval`、`useTimeout`、`useResource`、`useEvent`）调用时直接抛出 `"Hooks can only be called inside a view setup function"`。
- **影响**: 框架宣传的核心函数式 API（hooks）在生产中完全不可用。
- **修复**: 在 `mountCtx()` 的 `setup(ctx, params)` 调用前后分别 `setCurrentCtx(ctx)` / `setCurrentCtx(null)`。`hotSwapView()` 同理。

### 2. 生产代码中残留大量 console.log 调试日志

- **位置**: `src/view.ts`、`src/frame.ts`、`src/updater.ts`、`src/vdom.ts`、`src/utils.ts`
- **问题**: 上述文件中共计 30+ 处 `console.log` 调试语句（如 `[mountCtx]`、`[endUpdate]`、`[runDigest]`、`[mountZone]`、`[startCall]`、`[callFunction]`、`[vdomSetChildNodes]` 等），属于开发调试残留，不应进入生产代码。
- **影响**: 性能开销（每次 digest/mount 都打日志）、控制台噪音、信息泄漏。

## 二、功能缺失（P1）

### 3. `View.extend()` API 被移除但无迁移文档

- **位置**: `src/view.ts`
- **问题**: `origin/main` 导出 `View` 类（支持 `View.extend()`），alpha 分支仅导出 `defineView`。消费方（如 lark-demo、lark-docs）若使用 `View.extend()` 将编译失败。
- **评估**: 这是**预期行为**（函数式重写的核心目标就是移除 class API），但需确认所有消费方已迁移。

### 4. `Service` / `Payload` 类 API 被移除

- **位置**: `src/service.ts`
- **问题**: `origin/main` 导出 `Service`、`Payload` 类；alpha 导出 `createService`、`createPayload` 工厂函数。API 形状变化：`new Service(syncFn)` → `createService(syncFn)`。
- **评估**: 预期行为，但需确认消费方迁移。

### 5. `Cache` / `EventEmitter` / `Updater` 类 API 被移除

- **位置**: `src/cache.ts`、`src/event-emitter.ts`、`src/updater.ts`
- **问题**: 同上，类构造器 → 工厂函数。
- **评估**: 预期行为。

### 6. `store.create()` → `createStore()` 命名变更

- **位置**: `src/store.ts`、`src/index.ts`
- **问题**: `origin/main` 导出 `create`；alpha 导出 `createStore`。消费方 `import { create } from "@lark.js/mvc"` 将失败。
- **评估**: 预期行为（避免与 popular 库命名冲突），但属破坏性变更。

## 三、类型安全缺陷（P2）

### 7. `utils.ts` 使用 `@ts-ignore` 绕过类型检查

- **位置**: `src/utils.ts` 第 71、73 行
- **问题**: 使用 `// @ts-ignore` 访问 `globalThis.scheduler.yield`，违反"禁止 ts-ignore"规范。
- **修复**: 使用类型声明或 `as` 之外的类型守卫。

### 8. 源码中大量 `as` 类型断言

- **位置**: `src/view.ts`、`src/frame.ts`、`src/service.ts`、`src/updater.ts`、`src/store.ts`、`src/url-state.ts`、`src/framework.ts`、`src/hooks.ts`、`src/vdom.ts`、`src/hmr.ts`
- **问题**: 共计 30+ 处 `as` 类型断言，违反"禁止 type assert"规范。
- **详见**: 任务三修复清单。

## 四、测试质量问题（P3）

### 9. Hooks 完全无测试覆盖

- **位置**: `tests/`
- **问题**: `useState`、`useEffect`、`useStore` 等 hooks 没有任何测试文件覆盖。结合 P0 缺陷 1，hooks 系统既无测试也实际失效。

### 10. hmr.test.ts 存在欺骗测试

- **位置**: `tests/hmr.test.ts` 第 451-475 行
- **问题**: `initSpy` 被创建但从未接入 `NewView`，断言 `initSpy` 未被调用是恒真断言。

## 五、Dead Code（P4）

### 11. `viewAccept` / `viewDispose` 死代码

- **位置**: `src/view.ts` 第 655-669 行
- **问题**: 导出但无任何引用（index.ts 未导出，内部未调用）。

### 12. frame.ts 注释掉的缓存池代码

- **位置**: `src/frame.ts` 第 42-45、567-571 行
- **问题**: `MAX_FRAME_POOL`、`frameCache`、`reInitFrame`、`reInitFrameForCache` 被注释掉但保留在源码中。

### 13. `useEffect` 的 `_deps` 参数

- **位置**: `src/hooks.ts` 第 104 行
- **问题**: `_deps` 参数声明但从未使用（hooks 设计为 setup 只运行一次，无依赖追踪）。
