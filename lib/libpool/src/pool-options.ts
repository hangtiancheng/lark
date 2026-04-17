import PoolDefaults, { type IOptions } from "./pool-default.js";

class PoolOptions implements IOptions {
  max: number;
  min: number;
  fifo: boolean;
  autoStart: boolean;
  testOnBorrow: boolean;
  testOnReturn: boolean;
  priorityRange: number;
  maxWaitingClients?: number;
  numTestsPerEvictionRun: number;
  idleTimeoutMilliseconds: number;
  acquireTimeoutMilliseconds?: number;
  destroyTimeoutMilliseconds?: number;
  softIdleTimeoutMilliseconds: number;
  evictionRunIntervalMilliseconds: number;

  constructor(options?: IOptions) {
    const poolDefaults = new PoolDefaults();
    options = options ?? {};
    const max = options.max ?? poolDefaults.max;
    const min = options.min ?? poolDefaults.min;
    // isNaN('inf') === true
    // Number.isNaN('inf') === false
    this.max = Math.max(!Number.isInteger(max) ? 1 : max, 1);
    this.min = Math.min(!Number.isInteger(min) ? 0 : min, this.max);
    this.fifo = options.fifo ?? poolDefaults.fifo;
    this.autoStart = options.autoStart ?? poolDefaults.autoStart;
    this.testOnBorrow = options.testOnBorrow ?? poolDefaults.testOnBorrow;
    this.testOnReturn = options.testOnReturn ?? poolDefaults.testOnReturn;
    this.priorityRange = options.priorityRange ?? poolDefaults.priorityRange;
    // this.maxWaitingClients =
    //   options.maxWaitingClients ?? poolDefaults.maxWaitingClients;
    if (options.maxWaitingClients !== undefined) {
      this.maxWaitingClients = options.maxWaitingClients;
    }
    this.numTestsPerEvictionRun =
      options.numTestsPerEvictionRun ?? poolDefaults.numTestsPerEvictionRun;
    this.idleTimeoutMilliseconds =
      options.idleTimeoutMilliseconds ?? poolDefaults.idleTimeoutMilliseconds;
    // this.acquireTimeoutMilliseconds =
    //   options.acquireTimeoutMilliseconds ??
    //   poolDefaults.acquireTimeoutMilliseconds;
    if (options.acquireTimeoutMilliseconds !== undefined) {
      this.acquireTimeoutMilliseconds = options.acquireTimeoutMilliseconds;
    }
    // this.destroyTimeoutMilliseconds =
    //   options.destroyTimeoutMilliseconds ??
    //   poolDefaults.destroyTimeoutMilliseconds;
    if (options.destroyTimeoutMilliseconds !== undefined) {
      this.destroyTimeoutMilliseconds = options.destroyTimeoutMilliseconds;
    }
    this.softIdleTimeoutMilliseconds =
      options.softIdleTimeoutMilliseconds ??
      poolDefaults.softIdleTimeoutMilliseconds;
    this.evictionRunIntervalMilliseconds =
      options.evictionRunIntervalMilliseconds ??
      poolDefaults.evictionRunIntervalMilliseconds;
  }
}

export default PoolOptions;
