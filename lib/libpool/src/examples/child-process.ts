import loadCppLib from "./load-cpp-lib.js";

interface IData {
  isMinHeap: string;
  arr: number[];
}

function isDataType(data: unknown): data is IData {
  return (
    typeof data === "object" &&
    data !== null &&
    "isMinHeap" in data &&
    typeof data.isMinHeap === "boolean" &&
    "arr" in data &&
    Array.isArray(data.arr) &&
    data.arr.length > 0 &&
    typeof data.arr[0] === "number"
  );
}

process.on("message", async (data: unknown) => {
  console.log(typeof data);
  if (!isDataType(data)) {
    throw new TypeError();
  }
  const cppLib = loadCppLib();
  const { arr, isMinHeap } = data;
  const buf = Buffer.alloc(arr.length * 8);
  for (let i = 0; i < arr.length; i++) {
    buf.writeDoubleLE(arr[i], i * 8);
  }
  const heap = cppLib.create(isMinHeap ? 1 : 0);
  // @ts-ignore
  cppLib.heapify(heap, buf, arr.length);
  const getHeapArray = (size: number) => {
    const res = [];
    for (let i = 0; i < size; i++) {
      res.push(buf.readDoubleLE(i * 8));
    }
    return res;
  };

  console.log(
    "Initial arr (after heapify):",
    getHeapArray(cppLib.heapsize(heap)),
  );
  console.log("heap size:", cppLib.heapsize(heap));

  console.log("heap peek:", cppLib.heappeek(heap));

  console.log("heap pop:", cppLib.heappop(heap));
  console.log("heap pop:", cppLib.heappop(heap));

  console.log("arr.length:", cppLib.heapsize(heap));
  console.log("heap size:", cppLib.heapsize(heap));

  cppLib.heappush(heap, 0);
  console.log("After pushing 0, heap size:", cppLib.heapsize(heap));
  console.log("heap peek:", cppLib.heappeek(heap));
  console.log("arr array state:", getHeapArray(cppLib.heapsize(heap)));

  const replaced = cppLib.heapreplace(heap, 10);
  console.log("Replaced root:", replaced);
  console.log("heap peek after replace:", cppLib.heappeek(heap));

  const pushedPopped = cppLib.heappushpop(heap, 4);
  console.log("Pushed 4 and immediately popped:", pushedPopped);
  console.log("Final arr state:", getHeapArray(cppLib.heapsize(heap)));
  sendToMainProcess("");
});

function sendToMainProcess(response: unknown, code: 0 | -1 = 0) {
  process.send?.({ code, response });
}
