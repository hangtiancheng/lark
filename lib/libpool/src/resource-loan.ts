import Deferred from "./deferred.js";
import type PooledResource from "./poored-resource.js";

class ResourceLoan<T> extends Deferred<T> {
  creationTimestamp: number;
  pooledResource: PooledResource<T>;

  constructor(pooledResource: PooledResource<T>) {
    super();
    this.creationTimestamp = Date.now();
    this.pooledResource = pooledResource;
  }

  override reject(reason?: any): void {}
}

export default ResourceLoan;
