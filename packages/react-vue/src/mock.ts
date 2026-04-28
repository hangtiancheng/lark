import {
  type InjectionKey,
  type ComponentCustomProperties,
} from "@vue/runtime-core";
import { isFunction } from "@vue/shared";
import { getCurrentInstance } from "./component.js";
import { warn } from "../error-handling.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Plugin = any;

declare global {
  interface Window {
    __react_vue_context: AppContext;
  }
}

interface AppContext {
  app: App; // for devtools
  config: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalProperties: ComponentCustomProperties & Record<string, any>;
    isNativeTag: (tag: string) => boolean;
    performance: boolean;
    optionMergeStrategies: Record<
      string,
      (to: unknown, from: unknown) => unknown
    >;
    compilerOptions: Record<string, unknown>;
    errorHandler?: (err: unknown, instance: unknown, info: string) => void;
    warnHandler?: (msg: string, instance: unknown, trace: string) => void;
  };
  provides: Record<string | symbol, unknown>;

  // not supported
  mixins: unknown[];
  components: Record<string, unknown>;
  directives: Record<string, unknown>;
}

export interface App<HostElement = unknown> {
  version: string;
  config: AppContext["config"];
  use(plugin: Plugin, ...options: unknown[]): this;
  mixin(mixin: unknown): this;
  component(name: string, component?: unknown): this | unknown;
  directive(name: string, directive?: unknown): this | unknown;
  mount(
    rootContainer: HostElement | string,
    isHydrate?: boolean,
    isSVG?: boolean,
  ): unknown;
  unmount(): void;
  onUnmount(cb: () => void): void;
  provide<T>(key: InjectionKey<T> | string, value: T): this;
  runWithContext<T>(fn: () => T): T;
  _uid: number;
  _component: unknown;
  _props: unknown;
  _container: HostElement | null;
  _context: AppContext;
  _instance: unknown;
}

function createAppContext(): AppContext {
  return {
    app: null as unknown as App,
    config: {
      globalProperties: {},
      isNativeTag: () => false,
      performance: false,
      optionMergeStrategies: {},
      compilerOptions: {},
    },
    provides: {},

    // not supported
    mixins: [],
    components: {},
    directives: {},
  };
}

export function createApp() {
  const context =
    __BROWSER__ && window.__react_vue_context
      ? window.__react_vue_context
      : createAppContext();

  if (__BROWSER__) window.__react_vue_context = context;

  const installedPlugins = new Set();

  const app: App = (context.app = {
    version: "3.0.0",

    get config() {
      return context.config;
    },

    set config(_v) {
      if (__DEV__) {
        warn(
          "app.config cannot be replaced. Modify individual options instead.",
        );
      }
    },

    use(plugin: Plugin, ...options: unknown[]) {
      if (installedPlugins.has(plugin)) {
        if (__DEV__) warn("Plugin has already been applied to target app.");
      } else if (plugin && isFunction(plugin.install)) {
        installedPlugins.add(plugin);
        plugin.install(app, ...options);
      } else if (isFunction(plugin)) {
        installedPlugins.add(plugin);
        plugin(app, ...options);
      } else if (__DEV__) {
        warn(
          'A plugin must either be a function or an object with an "install" ' +
            "function.",
        );
      }

      return app;
    },

    provide<T>(key: InjectionKey<T> | string, value: T) {
      if (__DEV__ && (key as string | symbol) in context.provides) {
        warn(
          `App already provides property with key "${String(key)}". ` +
            "It will be overwritten with the new value.",
        );
      }
      // TypeScript doesn't allow symbols as index type
      // https://github.com/Microsoft/TypeScript/issues/24587
      context.provides[key as string] = value;
      return app;
    },

    mixin() {
      if (__DEV__) warn("`app.mixin` method is not supported in react-vue.");
      return app;
    },

    component() {
      if (__DEV__)
        warn("`app.component` method is not supported in react-vue.");
      return app;
    },

    directive() {
      if (__DEV__)
        warn("`app.directive` method is not supported in react-vue.");
      return app;
    },

    mount() {
      if (__DEV__) warn("`app.mount` method is not supported in react-vue.");
      return null;
    },

    unmount() {
      if (__DEV__) warn("`app.unmount` method is not supported in react-vue.");
    },

    onUnmount() {
      if (__DEV__)
        warn("`app.onUnmount` method is not supported in react-vue.");
    },

    runWithContext<T>(fn: () => T): T {
      return fn();
    },

    _uid: 0,
    _component: null,
    _props: null,
    _container: null,
    _context: context,
    _instance: null,
  });

  return app;
}
export function h() {
  // Mock implementation for h function
}

export function provide<T>(key: InjectionKey<T> | string | number, value: T) {
  const instance = getCurrentInstance();

  if (instance) {
    instance.provides[key as string] = value;
  }
}

export function hasInjectionContext() {
  return !!getCurrentInstance();
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined;
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false,
): T;
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true,
): T;
export function inject(
  key: InjectionKey<unknown> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false,
) {
  const instance = getCurrentInstance();

  if (instance) {
    if (instance.provides && (key as string | symbol) in instance.provides) {
      // TS doesn't allow symbol as index type
      return instance.provides[key as string];
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue()
        : defaultValue;
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`);
    }
  } else if (__DEV__) {
    warn("inject() can only be used inside setup() or functional components.");
  }
}
