import type { IOptions } from "./pool-default.js";
import Pool from "./pool.js";

import type { IFactory } from "./factory-validator.js";
export { default as Pool } from "./pool.js";
export { default as Deque } from "./deque.js";
export { default as PriorityQueue } from "./priority-queue.js";
export { default as DefaultEvictor } from "./default-evictor.js";

export function createPool<T>(factory: IFactory<T>, options?: IOptions) {
  return new Pool(factory, options);
}
