import { crc32, HashFunc } from "./crc32.js";

export class ConsistentHash {
  private hashFunc: HashFunc;
  private replicas: number;
  private vNode2realNode: Map<number, string>;
  private sortedVNodeHashes: number[];
  constructor(replicas: number = 50, hashFunc?: HashFunc) {
    this.replicas = replicas;
    this.hashFunc = hashFunc || crc32;
    this.vNode2realNode = new Map();
    this.sortedVNodeHashes = [];
  }

  addRealNode(...realNodeKeys: string[]): void {
    for (const key of realNodeKeys) {
      for (let i = 0; i < this.replicas; i++) {
        const vNodeKey = key + i.toString();
        const vNodeHash = this.hashFunc(vNodeKey);
        this.sortedVNodeHashes.push(vNodeHash);
        this.vNode2realNode.set(vNodeHash, key);
      }
    }
    this.sortedVNodeHashes.sort((a, b) => a - b);
  }

  getRealNode(key: string): [string, boolean] {
    if (this.sortedVNodeHashes.length === 0) {
      return ["", false];
    }
    const hash = this.hashFunc(key);
    let idx = this.binarySearch(hash);
    idx = idx % this.sortedVNodeHashes.length;
    const vNodeHash = this.sortedVNodeHashes[idx];
    const realNodeKey = this.vNode2realNode.get(vNodeHash);
    return [realNodeKey || "", !!realNodeKey];
  }

  private binarySearch(target: number): number {
    let left = 0;
    let right = this.sortedVNodeHashes.length;
    while (left < right) {
      const mid = left + ((right - left) >> 1);
      if (this.sortedVNodeHashes[mid] < target) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    return left;
  }

  get size(): number {
    return this.sortedVNodeHashes.length;
  }
}
