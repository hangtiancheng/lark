import { SyncHook, AsyncParallelHook } from "tapable";

class TapableDemo {
  constructor() {
    this.hooks = {
      syncHook: new SyncHook(["arg1", "arg2"]),
      asyncHook: new AsyncParallelHook(["arg1", "arg2", "arg3"]),
      asyncHook2: new AsyncParallelHook(["arg1", "arg2", "arg3"]),
    };
  }

  publishSyncHook(arg1, arg2) {
    this.hooks.syncHook.call(arg1, arg2);
  }

  publishAsyncHookUsePromise(arg1, arg2, arg3) {
    return this.hooks.asyncHook.promise(arg1, arg2, arg3).then((res) => {
      // publishAsyncHookUsePromise 3 4 [ 3, 4 ]
      console.log("publishAsyncHookUsePromise", arg1, arg2, arg3);
    });
  }

  publishAsyncHookUseAsync(arg1, arg2, arg3) {
    this.hooks.asyncHook2.callAsync(arg1, arg2, arg3, (callbackArg) => {
      console.log("callbackArg", callbackArg);
      // publishAsyncHookUseAsync 5 6 [ 6, 5 ]
      console.log("publishAsyncHookUseAsync", arg1, arg2, arg3);
    });
  }
}

const tapableDemo = new TapableDemo();

// subscribe
tapableDemo.hooks.syncHook.tap("eventName", (arg1, arg2) => {
  console.log("tap", arg1, arg2); // tap 1 2
});

tapableDemo.publishSyncHook(1 /** arg1 */, 2 /** arg2 */);

// subscribe
tapableDemo.hooks.asyncHook.tapPromise("eventName2", (arg1, arg2, arg3) => {
  console.log("tapPromise", arg1, arg2, arg3); // tapPromise 3 4 []
  return new Promise((resolve) => {
    setTimeout(() => {
      arg3.push(arg1, arg2);
      resolve(arg3);
    }, 3000);
  });
});

tapableDemo.publishAsyncHookUsePromise(
  3 /** arg1 */,
  4 /** arg2 */,
  [] /** arg3 */,
);

// subscribe
tapableDemo.hooks.asyncHook2.tapAsync(
  "eventName3",
  async (arg1, arg2, arg3, callback) => {
    console.log("tapAsync", arg1, arg2, arg3); // tapAsync 5 6 []
    await new Promise((resolve) => {
      setTimeout(() => {
        arg3.push(arg1, arg2);
        callback(arg3);
        resolve(arg3);
      }, 5000);
    });
  },
);

tapableDemo.publishAsyncHookUseAsync(
  5 /** arg1 */,
  6 /** arg2 */,
  [] /** arg3 */,
);
