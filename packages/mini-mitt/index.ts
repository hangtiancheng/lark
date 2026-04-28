type TCallback = (...args: unknown[]) => void;

class MiniMitt {
  eventName2callbacks: Map<string, Set<TCallback>>;
  constructor() {
    this.eventName2callbacks = new Map<string, Set<TCallback>>();
  }

  on(eventName: string, callback: TCallback) {
    if (this.eventName2callbacks.has(eventName)) {
      this.eventName2callbacks.get(eventName)?.add(callback);
      return;
    }

    this.eventName2callbacks.set(eventName, new Set<TCallback>([callback]));
  }

  once(eventName: string, callback: TCallback) {
    const wrappedCallback = (...args: unknown[]) => {
      callback.call(undefined, ...args);
      this.off(eventName, wrappedCallback);
    };

    this.on(eventName, wrappedCallback);
  }

  emit(eventName: string, ...args: unknown[]) {
    if (!this.eventName2callbacks.has(eventName)) {
      return;
    }

    this.eventName2callbacks
      .get(eventName)
      ?.forEach((callback) => callback(...args));
  }

  off(eventName: string, callback: TCallback) {
    if (!this.eventName2callbacks.has(eventName)) {
      return;
    }

    this.eventName2callbacks.get(eventName)?.delete(callback);
    if (this.eventName2callbacks.get(eventName)?.size === 0) {
      this.eventName2callbacks.delete(eventName);
    }
  }

  clear() {
    this.eventName2callbacks.clear();
  }
}

export const miniMitt = new MiniMitt();
