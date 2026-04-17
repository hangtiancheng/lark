const heap = require("./build/Release/heap.node");

const arr = [1, 6, 4, 3, 2];
const compare = (a, b) => a - b;
heap.heapify(arr, compare);

console.log("Initial arr (after heapify):", arr);
console.log("heap size:", arr.length);

console.log("heap peek:", arr[0]);

console.log("heap pop:", heap.heappop(arr, compare));
console.log("heap pop:", heap.heappop(arr, compare));

console.log("arr.length:", arr.length);
console.log("heap size:", arr.length);

heap.heappush(arr, 0, compare);
console.log("After pushing 0, heap size:", arr.length);
console.log("heap peek:", arr[0]);
console.log("arr array state:", arr);

const replaced = heap.heapreplace(arr, 10, compare);
console.log("Replaced root:", replaced);
console.log("heap peek after replace:", arr[0]);

const pushedPopped = heap.heappushpop(arr, 4, compare);
console.log("Pushed 4 and immediately popped:", pushedPopped);
console.log("Final arr state:", arr);
