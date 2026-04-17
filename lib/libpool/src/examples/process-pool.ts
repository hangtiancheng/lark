import type { IFactory } from "../factory-validator.js";
import { ChildProcess, fork, type Serializable } from "node:child_process";
import type { IOptions } from "../pool-default.js";
import { cpus } from "node:os";
import { createPool } from "../index.js";

type TRes =
  | { code: 0; response: unknown }
  | { code: -1; response: string | Error | SerializableError };

// JSON.stringify
// 检查对象是否有 toJSON 方法
// 如果有, 则调用 toJSON 方法, 使用 toJSON 方法的返回值进行序列化
// 如果没有, 则枚举 Enumerable 可枚举属性
class SerializableError extends Error {
  constructor(
    public code: number,
    public override message: string,
  ) {
    super(message);
  }
  toJSON() {
    return {
      code: this.code,
      // Error 对象的 message, name, stack 属性都是不可枚举的
      message: this.message,
      name: this.name,
      stack: this.stack,
    };
  }
}

// console.log(SerializableError[Symbol.hasInstance].toString())

function checkPidExists(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0); // 检查进程是否存在
    return true;
  } catch (err) {
    // 如果进程不存在或没有访问权限, 则会抛出异常
    return false;
  }
}

export default class ChildProcessPool {
  private pool;

  constructor(private scriptPath: string) {
    const factory: IFactory<ChildProcess> = {
      async create() {
        const startTime = performance.now();
        const childProcess = fork(scriptPath, {
          stdio: "inherit",
          env: process.env,
        });
        const { pid } = childProcess;
        const elapsed = performance.now() - startTime;
        if (!pid) {
          throw new Error(`pid: ${pid}, elapsed: ${elapsed}`);
        }
        return childProcess;
      },
      destroy: async function (childProcess: ChildProcess) {
        const ok = childProcess.kill();
        if (!ok) {
          console.error("child process kill failed");
        }
      },
      validate: async function (childProcess: ChildProcess) {
        return (
          childProcess.pid !== undefined && checkPidExists(childProcess.pid)
        );
      },
    };

    const options: IOptions = {
      max: cpus().length,
      min: 1,
      evictionRunIntervalMilliseconds: 60 * 1000,
      softIdleTimeoutMilliseconds: 3 * 60 * 1000,
      testOnBorrow: true,
      testOnReturn: true,
    };
    this.pool = createPool(factory, options);
    console.log(this.status);
  }

  get status() {
    return {
      scriptPath: this.scriptPath,
      available: this.pool.available,
      borrowed: this.pool.borrowed,
      max: this.pool.max,
      min: this.pool.min,
      pending: this.pool.pending,
      size: this.pool.size,
      spareResourceCapacity: this.pool.spareResourceCapacity,
    };
  }

  async destroy() {
    await this.pool
      .drain()
      .then(() => this.pool.clear())
      .catch(console.log);
  }

  async callWorkerProcess(data: Serializable) {
    this.pool
      .use((childProcess) => {
        const task = new Promise((resolve, reject) => {
          childProcess.once("message", (res: TRes /** Serializable */) => {
            if (res.code === 0) {
              resolve(res.response);
              return;
            }
            if (res.response instanceof SerializableError) {
              reject(res.response);
            } else {
              const { code, response } = res;
              reject(new SerializableError(code, response.toString()));
            }
          });

          childProcess.once("exit", (code, signal) => {
            reject(new SerializableError(code ?? -1, signal ?? "exit"));
          });

          childProcess.send(data);
        });
        return task;
      })
      .then((res) => {
        console.log("call work process ok");
        console.log(this.status);
        return res;
      });
  }
}
