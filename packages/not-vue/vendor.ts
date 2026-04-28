export interface ChangeRecord {
  type: "set" | "delete";
  target: object;
  key: PropertyKey; // string | number | symbol
  oldValue: unknown;
  newValue: unknown;
  path: string;
}

type BatchedChangeHandler = (changes: ChangeRecord[]) => void;

type ProxyChangeHandler = ((change: ChangeRecord) => void) & {
  __proxyToRaw?: WeakMap<object, object>;
  __wrapChild?: (value: unknown, childPath: string) => unknown;
};

export type MiniVuePublicInstance<
  TState extends object = Record<string, unknown>,
> = TState & {
  $data: TState;
  $changes: ChangeRecord[];
} & Record<string, unknown>;

export type ComputedMap<TPublicInstance> = Record<
  string,
  (this: TPublicInstance) => unknown
>;

interface MiniVueHooks<TPublicInstance> {
  onChanges?: (
    this: TPublicInstance,
    changes: ChangeRecord[],
    vm: TPublicInstance,
  ) => void;
  onMounted?: (this: TPublicInstance, vm: TPublicInstance) => void;
}

export interface MiniVueOptions<
  TState extends object,
  TPublicInstance extends MiniVuePublicInstance<TState>,
  TMethods extends object,
  TComputed extends ComputedMap<TPublicInstance> = Record<string, never>,
> {
  el: string;
  template?: string;
  data?: TState;
  methods?: TMethods;
  computed?: TComputed;
  onChanges?: MiniVueHooks<TPublicInstance>["onChanges"];
  onMounted?: MiniVueHooks<TPublicInstance>["onMounted"];
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function joinPath(basePath: string | undefined, key: PropertyKey): string {
  return basePath ? `${basePath}.${String(key)}` : String(key);
}

export function createProxy<T>(
  target: T,
  handler: ProxyChangeHandler,
  basePath = "",
): T {
  if (!isObject(target)) {
    return target;
  }

  return new Proxy(target, {
    get(currentTarget, key, receiver) {
      const value = Reflect.get(currentTarget, key, receiver);

      if (typeof key === "symbol") {
        return value;
      }

      if (typeof handler.__wrapChild === "function") {
        return handler.__wrapChild(value, joinPath(basePath, key));
      }

      return value;
    },
    set(currentTarget, key, value, receiver) {
      const rawValue =
        isObject(value) && handler.__proxyToRaw?.has(value)
          ? handler.__proxyToRaw.get(value)
          : value;
      const oldValue = Reflect.get(currentTarget, key);
      const result = Reflect.set(currentTarget, key, rawValue, receiver);

      if (oldValue !== rawValue) {
        handler({
          type: "set",
          target: currentTarget,
          key,
          oldValue,
          newValue: rawValue,
          path: joinPath(basePath, key),
        });
      }

      return result;
    },
    deleteProperty(currentTarget, key) {
      if (!Reflect.has(currentTarget, key)) {
        return true;
      }

      const oldValue = Reflect.get(currentTarget, key);
      const result = Reflect.deleteProperty(currentTarget, key);

      if (result) {
        handler({
          type: "delete",
          target: currentTarget,
          key,
          oldValue,
          newValue: undefined,
          path: joinPath(basePath, key),
        });
      }

      return result;
    },
  }) as T;
}

export function observe<T>(data: T, handler: BatchedChangeHandler): T {
  const rawToProxyMap = new WeakMap<object, Map<string, object>>();
  const proxyToRaw = new WeakMap<object, object>();
  const changeList: ChangeRecord[] = [];
  let scheduled = false;

  const flushChanges = (): void => {
    scheduled = false;

    if (changeList.length === 0) {
      return;
    }

    const batch = changeList.slice();
    changeList.length = 0;
    handler(batch);
  };

  const scheduleFlush = (): void => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    Promise.resolve().then(flushChanges);
  };

  const getPathProxyMap = (target: object): Map<string, object> => {
    let pathProxyMap = rawToProxyMap.get(target);

    if (!pathProxyMap) {
      pathProxyMap = new Map<string, object>();
      rawToProxyMap.set(target, pathProxyMap);
    }

    return pathProxyMap;
  };

  const wrap = <TWrapped>(target: TWrapped, basePath: string): TWrapped => {
    if (!isObject(target)) {
      return target;
    }

    const rawTarget = (proxyToRaw.get(target) ?? target) as object;
    const pathKey = basePath || "";
    const pathProxyMap = getPathProxyMap(rawTarget);

    if (pathProxyMap.has(pathKey)) {
      return pathProxyMap.get(pathKey) as TWrapped;
    }

    const changeHandler: ProxyChangeHandler = (change) => {
      changeList.push(change);
      scheduleFlush();
    };

    changeHandler.__proxyToRaw = proxyToRaw;
    changeHandler.__wrapChild = (value, childPath) => wrap(value, childPath);

    const proxy = createProxy(rawTarget, changeHandler, basePath);
    proxyToRaw.set(proxy, rawTarget);
    pathProxyMap.set(pathKey, proxy);
    return proxy as TWrapped;
  };

  return wrap(data, "");
}

export class MiniVue<
  TState extends object,
  TPublicInstance extends MiniVuePublicInstance<TState>,
  TMethods extends object,
  TComputed extends ComputedMap<TPublicInstance> = Record<
    string,
    (this: TPublicInstance) => unknown
  >,
> {
  readonly $el: Element | null;
  readonly $template: string;
  readonly $methods: TMethods;
  readonly $computed: TComputed;
  readonly $bindings: (() => void)[];
  readonly $expressionCache: Map<
    string,
    (scope: Record<string, unknown>) => unknown
  >;
  readonly $hooks: MiniVueHooks<TPublicInstance>;
  readonly $data: TState;
  readonly proxy: TPublicInstance;
  $changes: ChangeRecord[];

  constructor(
    options: MiniVueOptions<TState, TPublicInstance, TMethods, TComputed>,
  ) {
    this.$el = document.querySelector(options.el);
    this.$template = options.template ?? "";
    this.$methods = (options.methods ?? {}) as TMethods;
    this.$computed = (options.computed ?? {}) as TComputed;
    this.$bindings = [];
    this.$expressionCache = new Map();
    this.$hooks = {
      onChanges: options.onChanges,
      onMounted: options.onMounted,
    };
    this.$changes = [];

    this.$data = observe((options.data ?? {}) as TState, (changes) => {
      this.$changes = changes;
      this.flushBindings();

      if (typeof this.$hooks.onChanges === "function") {
        this.$hooks.onChanges.call(this.proxy, changes, this.proxy);
      }
    });

    this.proxy = this.createPublicInstance();

    if (this.$el) {
      this.mount();
    }
  }

  private createPublicInstance(): TPublicInstance {
    return new Proxy({} as TPublicInstance, {
      has: (_target, key) =>
        key === "$data" ||
        key === "$changes" ||
        (typeof key === "string" &&
          (key in this.$data ||
            this.isComputedKey(key) ||
            key in this.$methods ||
            key in this)),
      get: (_target, key) => this.resolvePublicValue(key),
      set: (_target, key, value) => {
        if (typeof key === "string" && this.isComputedKey(key)) {
          return false;
        }

        if (typeof key === "string") {
          (this.$data as Record<string, unknown>)[key] = value;
          return true;
        }

        return Reflect.set(this, key, value);
      },
    }) as TPublicInstance;
  }

  private mount(): void {
    if (!this.$el) {
      return;
    }

    const fragment = this.templateToFragment(this.$template);
    this.compile(fragment);
    this.$el.innerHTML = "";
    this.$el.appendChild(fragment);
    this.flushBindings();

    if (typeof this.$hooks.onMounted === "function") {
      this.$hooks.onMounted.call(this.proxy, this.proxy);
    }
  }

  private templateToFragment(template: string): DocumentFragment {
    const templateElement = document.createElement("template");
    templateElement.innerHTML = template.trim();
    return templateElement.content.cloneNode(true) as DocumentFragment;
  }

  private compile(node: Node): void {
    Array.from(node.childNodes).forEach((child) => {
      if (this.isTextNode(child)) {
        this.compileText(child);
      } else if (this.isElementNode(child)) {
        this.compileElement(child);
      }

      if (child.childNodes.length > 0) {
        this.compile(child);
      }
    });
  }

  private compileText(node: Text): void {
    const template = node.textContent ?? "";
    const interpolationRegExp = /\{\{([\s\S]+?)\}\}/;

    if (!interpolationRegExp.test(template)) {
      return;
    }

    this.$bindings.push(() => {
      node.textContent = template.replace(
        /\{\{([\s\S]+?)\}\}/g,
        (_match, expr: string) =>
          this.toDisplayString(this.evaluate(expr.trim())),
      );
    });
  }

  private compileElement(node: Element): void {
    Array.from(node.attributes).forEach((attr) => {
      const attrName = attr.name;
      const expr = attr.value.trim();
      const eventName = this.getEventName(attrName);

      if (attrName === "v-if") {
        this.bindIf(node, expr);
        return;
      }

      if (attrName === "v-html") {
        this.bindHTML(node, expr);
        return;
      }

      if (eventName) {
        this.bindEvent(node, eventName, expr);
        return;
      }

      if (attrName.startsWith(":")) {
        this.bindAttr(node, attrName.slice(1), expr);
      }
      if (attrName.startsWith("v-bind:")) {
        this.bindAttr(node, attrName.slice(7), expr);
      }
    });
  }

  private bindHTML(node: Element, expr: string): void {
    this.$bindings.push(() => {
      const value = this.evaluate(expr);
      node.innerHTML =
        value === null || value === undefined ? "" : String(value);
    });
  }

  private bindIf(node: Element, expr: string): void {
    const parent = node.parentNode;
    if (!parent) {
      return;
    }

    const anchor = document.createComment(`v-if:${expr}`);
    parent.insertBefore(anchor, node);

    this.$bindings.push(() => {
      const shouldShow = Boolean(this.evaluate(expr));
      const currentParent = anchor.parentNode;

      if (!currentParent) {
        return;
      }

      if (shouldShow) {
        if (!node.parentNode) {
          currentParent.insertBefore(node, anchor.nextSibling);
        }
      } else if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
  }

  private bindEvent(node: Element, eventName: string, expr: string): void {
    const listener = (event: Event): void => {
      const directMethod = (this.$methods as Record<string, unknown>)[expr];

      if (typeof directMethod === "function") {
        directMethod.call(this.proxy, event);
        return;
      }

      this.evaluate(expr, { $event: event });
    };

    node.addEventListener(eventName, listener);
  }

  private bindAttr(node: Element, attrKey: string, expr: string): void {
    this.$bindings.push(() => {
      const value = this.evaluate(expr);

      if (value === false || value === null || value === undefined) {
        node.removeAttribute(attrKey);
        return;
      }

      node.setAttribute(attrKey, String(value));
    });
  }

  private evaluate(
    expression: string,
    extraScope: Record<string, unknown> = {},
  ): unknown {
    const proxyView = this.proxy as Record<string, unknown>;
    const scope = new Proxy(extraScope, {
      has: (target, key) =>
        typeof key === "string"
          ? key in target || key in proxyView
          : key in target,
      get: (target, key) => {
        if (typeof key === "string" && key in target) {
          return target[key];
        }

        return typeof key === "string" ? proxyView[key] : undefined;
      },
      set: (target, key, value) => {
        if (typeof key === "string" && key in target) {
          target[key] = value;
        } else if (typeof key === "string") {
          proxyView[key] = value;
        }

        return true;
      },
    });

    try {
      let evaluator = this.$expressionCache.get(expression);
      if (!evaluator) {
        evaluator = new Function(
          "scope",
          `with (scope) { return (${expression}); }`,
        ) as (scope: Record<string, unknown>) => unknown;
        this.$expressionCache.set(expression, evaluator);
      }
      return evaluator(scope);
    } catch (error) {
      console.error(`Expression evaluation failed: ${expression}`, error);
      return "";
    }
  }

  private toDisplayString(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private flushBindings(): void {
    this.$bindings.forEach((binding) => binding());
  }

  private resolvePublicValue(key: PropertyKey): unknown {
    if (key === "$data") {
      return this.$data;
    }

    if (key === "$changes") {
      return this.$changes;
    }

    if (typeof key === "string" && key in this.$data) {
      return this.$data[key as keyof TState];
    }

    if (typeof key === "string") {
      const computedGetter = this.$computed[key];
      if (typeof computedGetter === "function") {
        return computedGetter.call(this.proxy);
      }

      const method = (this.$methods as Record<string, unknown>)[key];
      if (typeof method === "function") {
        return method.bind(this.proxy);
      }
    }

    return Reflect.get(this, key);
  }

  private isComputedKey(key: string): boolean {
    return key in this.$computed;
  }

  private getEventName(attrName: string): string | null {
    if (attrName.startsWith("v-on:")) {
      return attrName.slice(5);
    }

    if (attrName.startsWith("@")) {
      return attrName.slice(1);
    }

    return null;
  }

  private isElementNode(node: Node): node is Element {
    return node.nodeType === Node.ELEMENT_NODE;
  }

  private isTextNode(node: Node): node is Text {
    return node.nodeType === Node.TEXT_NODE;
  }
}
