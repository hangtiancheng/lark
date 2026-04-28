export interface IOptions {
  max?: number; // Default 1
  min?: number; // Default 0
  fifo?: boolean; // Default true
  autoStart?: boolean; // Default true
  testOnBorrow?: boolean; // Default false
  testOnReturn?: boolean; // Default false
  priorityRange?: number; // Default 1
  maxWaitingClients?: number | undefined; // Default undefined
  numTestsPerEvictionRun?: number; // Default 3
  idleTimeoutMilliseconds?: number; // Default 30000
  acquireTimeoutMilliseconds?: number | undefined; // Default undefined
  destroyTimeoutMilliseconds?: number | undefined; // Default undefined
  softIdleTimeoutMilliseconds?: number; // Default -1
  evictionRunIntervalMilliseconds?: number; // Default 0
}

class PoolDefaults implements IOptions {
  max: number;
  min: number;
  fifo: boolean;
  autoStart: boolean;
  testOnBorrow: boolean;
  testOnReturn: boolean;
  priorityRange: number;
  maxWaitingClients?: number | undefined;
  numTestsPerEvictionRun: number;
  idleTimeoutMilliseconds: number;
  acquireTimeoutMilliseconds?: number | undefined;
  destroyTimeoutMilliseconds?: number | undefined;
  softIdleTimeoutMilliseconds: number;
  evictionRunIntervalMilliseconds: number;

  constructor() {
    this.max = 1;
    this.min = 0;
    this.fifo = true;
    this.autoStart = true;
    this.testOnBorrow = false;
    this.testOnReturn = false;
    this.priorityRange = 1;
    this.maxWaitingClients = undefined; // 10;
    this.numTestsPerEvictionRun = 3;
    this.idleTimeoutMilliseconds = 30000;
    this.acquireTimeoutMilliseconds = undefined; // 10;
    this.destroyTimeoutMilliseconds = undefined; // 10;
    this.softIdleTimeoutMilliseconds = -1;
    this.evictionRunIntervalMilliseconds = 0;
  }
}

export default PoolDefaults;
