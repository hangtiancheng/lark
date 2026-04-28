import PooledResource from "./poored-resource.js";

export interface IEvictorConfig {
  softIdleTimeoutMilliseconds: number;
  idleTimeoutMilliseconds: number;
  min: number;
}

export interface IEvictor<T> {
  evict(
    config: IEvictorConfig,
    pooledResource: PooledResource<T>,
    availableObjectsCount: number,
  ): boolean;
}

class DefaultEvictor<T> implements IEvictor<T> {
  evict(
    config: IEvictorConfig,
    pooledResource: PooledResource<T>,
    availableObjectsCount: number,
  ): boolean {
    const idleTime = Date.now() - (pooledResource.lastIdleTime ?? 0);
    if (
      config.softIdleTimeoutMilliseconds > 0 &&
      config.softIdleTimeoutMilliseconds < idleTime &&
      config.min < availableObjectsCount
    ) {
      return true;
    }
    if (config.idleTimeoutMilliseconds < idleTime) {
      return true;
    }
    return false;
  }
}

export default DefaultEvictor;
