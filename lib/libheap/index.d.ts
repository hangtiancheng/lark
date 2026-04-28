/**
 * Compare function type: returns negative if a < b, positive if a > b, 0 if equal
 */
export type CompareFunction = (a: number, b: number) => number;

/**
 * Transform array into a heap in-place
 * @param arr - Array to heapify
 * @param compare - Comparison function
 * @returns The heapified array
 */
export function heapify(arr: number[], compare: CompareFunction): number[];

/**
 * Pop and return the smallest item from the heap
 * @param arr - Heap array
 * @param compare - Comparison function
 * @returns The smallest item
 * @throws Error if heap is empty
 */
export function heappop(arr: number[], compare: CompareFunction): number;

/**
 * Push item onto heap
 * @param arr - Heap array
 * @param item - Item to push
 * @param compare - Comparison function
 */
export function heappush(
  arr: number[],
  item: number,
  compare: CompareFunction,
): void;

/**
 * Push item on heap, then pop and return the smallest item
 * More efficient than heappush() followed by heappop()
 * @param arr - Heap array
 * @param item - Item to push
 * @param compare - Comparison function
 * @returns The smallest item
 */
export function heappushpop(
  arr: number[],
  item: number,
  compare: CompareFunction,
): number;

/**
 * Pop and return the smallest item, then push new item
 * More efficient than heappop() followed by heappush()
 * @param arr - Heap array
 * @param item - Item to push
 * @param compare - Comparison function
 * @returns The smallest item (before replacement)
 * @throws Error if heap is empty
 */
export function heapreplace(
  arr: number[],
  item: number,
  compare: CompareFunction,
): number;
