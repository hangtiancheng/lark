/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

let activeEffect: ReactiveEffect;
let shouldTrack = true;

const targetMap = new WeakMap<
  object,
  Map<string, Set<ReactiveEffect>> // key2deps
>();

class ReactiveEffect {
  private _fn: Function; // 副作用函数
  public scheduler?: Function; // 调度函数
  depsList: Set<ReactiveEffect>[] = []; // 依赖集合
  active = true; // 是否激活
  onStop?: Function;

  constructor(fn: Function, scheduler?: Function) {
    this._fn = fn;
    this.scheduler = scheduler;
  }
  run() {
    if (!this.active) {
      // console.log(shouldTrack)
      return this._fn();
    }
    shouldTrack = true;
    activeEffect = this;
    const ret = this._fn();
    shouldTrack = false;
    return ret;
  }

  stop() {
    if (this.active) {
      // cleanupEffects
      this.depsList.forEach((deps) => {
        deps.delete(this);
      });
      this.depsList.length = 0;
      this.onStop?.();
      this.active = false;
    }
  }
}

export function effect(
  fn: Function,
  options?: {
    scheduler?: Function;
    onStop?: Function;
  },
) {
  const scheduler = options?.scheduler;
  const _effect = new ReactiveEffect(fn, scheduler);
  // _effect.onStop = options?.onStop;
  Object.assign(_effect, options);
  _effect.run();
  const runner: any = _effect.run.bind(_effect);
  runner.effect = _effect;
  return runner;
}

export function track(target: object, key: string) {
  if (!activeEffect || !shouldTrack) {
    return;
  }
  let key2deps = targetMap.get(target);
  if (!key2deps) {
    key2deps = new Map<string, Set<ReactiveEffect>>();
    targetMap.set(target, key2deps);
  }
  let deps = key2deps.get(key);
  if (!deps) {
    deps = new Set<ReactiveEffect>();
    key2deps.set(key, deps);
  }
  if (deps.has(activeEffect)) {
    return;
  }
  deps.add(activeEffect);
  activeEffect.depsList.push(deps);
}

export function trigger(target: object, key: string) {
  const keyEffects = targetMap.get(target);
  const effects = keyEffects?.get(key);
  if (!effects) {
    return;
  }
  for (const effect of effects) {
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}

export function stop(runner: Function & { effect: ReactiveEffect }) {
  runner.effect.stop();
}
