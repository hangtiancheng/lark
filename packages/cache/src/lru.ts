export interface Value {
  len(): number;
}

class ListNode<K, V> {
  key: K;
  value: V;
  prev: ListNode<K, V> | null = null;
  next: ListNode<K, V> | null = null;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }
}

class DoublyLinkedList<K, V> {
  private head: ListNode<K, V>;
  private tail: ListNode<K, V>;
  private _length: number = 0;

  constructor() {
    this.head = new ListNode<K, V>(null as any, null as any);
    this.tail = new ListNode<K, V>(null as any, null as any);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  pushFront(node: ListNode<K, V>): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
    this._length++;
  }

  remove(node: ListNode<K, V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
    node.prev = null;
    node.next = null;
    this._length--;
  }

  moveToFront(node: ListNode<K, V>): void {
    this.remove(node);
    this.pushFront(node);
  }

  back(): ListNode<K, V> | null {
    if (this._length === 0) {
      return null;
    }
    return this.tail.prev;
  }

  get length(): number {
    return this._length;
  }
}

export class Lru<V extends Value> {
  private list: DoublyLinkedList<string, V>;
  private cache: Map<string, ListNode<string, V>>;
  private maxBytes: number;
  private nBytes: number = 0;
  private onEvicted?: (key: string, value: V) => void;

  constructor(maxBytes: number, onEvicted?: (key: string, value: V) => void) {
    this.maxBytes = maxBytes;
    this.list = new DoublyLinkedList();
    this.cache = new Map();
    this.onEvicted = onEvicted;
  }

  get(key: string): [V | undefined, boolean] {
    const node = this.cache.get(key);
    if (node) {
      this.list.moveToFront(node);
      return [node.value, true];
    }
    return [undefined, false];
  }

  add(key: string, value: V): void {
    const existingNode = this.cache.get(key);
    if (existingNode) {
      this.list.moveToFront(existingNode);
      this.nBytes += value.len() - existingNode.value.len();
      existingNode.value = value;
    } else {
      const node = new ListNode(key, value);
      this.list.pushFront(node);
      this.cache.set(key, node);
      this.nBytes += key.length + value.len();
    }
    while (this.maxBytes !== 0 && this.nBytes > this.maxBytes) {
      this.evict();
    }
  }

  private evict(): void {
    const node = this.list.back();
    if (node) {
      this.list.remove(node);
      this.cache.delete(node.key);
      this.nBytes -= node.key.length + node.value.len();
      if (this.onEvicted) {
        this.onEvicted(node.key, node.value);
      }
    }
  }

  get length(): number {
    return this.list.length;
  }
}
