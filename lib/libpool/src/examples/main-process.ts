import { fileURLToPath } from "node:url";
import ChildProcessPool from "./process-pool.js";
import { dirname, resolve } from "node:path";

const filename__ = fileURLToPath(import.meta.url);
const dirname__ = dirname(filename__)

const childProcessPool = new ChildProcessPool(
  resolve(dirname__, './child-process.js')
);
childProcessPool.callWorkerProcess({
  isMinHeap: true,
  arr: [1, 6, 4, 3, 2],
});

process.on("beforeExit", () => {
  childProcessPool.destroy();
});
