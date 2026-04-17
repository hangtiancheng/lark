import Queue from "./queue.js";
import ResourceRequest from "./resource-request.js";

export interface IPriorityQueue<T> {
  get length(): number;
  enqueue(obj: ResourceRequest<T>, priority?: number): void;
  dequeue(): ResourceRequest<T> | undefined;
  get head(): ResourceRequest<T> | undefined;
  get tail(): ResourceRequest<T> | undefined;
}

export default class PriorityQueue<T> implements IPriorityQueue<T> {
  private size: number;
  private slots: Queue<T>[];

  constructor(size: number) {
    this.size = Math.max(size, 1);
    this.slots = [];
    for (let i = 0; i < this.size; i++) {
      this.slots.push(new Queue<T>());
    }
  }

  get length(): number {
    let len = 0;
    for (let i = 0; i < this.slots.length; i++) {
      len += this.slots[i].length;
    }
    return len;
  }

  enqueue(resourceRequest: ResourceRequest<T>, priority?: number): void {
    priority = priority ?? 0;
    if (priority < 0 || priority >= this.size) {
      priority = this.size - 1;
    }
    this.slots[priority].push(resourceRequest);
  }

  dequeue(): ResourceRequest<T> | undefined {
    for (let i = 0; i < this.slots.length; i += 1) {
      if (this.slots[i].length) {
        return this.slots[i].shift();
      }
    }
    return undefined;
  }

  get head(): ResourceRequest<T> | undefined {
    for (let i = 0; i < this.slots.length; i += 1) {
      if (this.slots[i].length > 0) {
        return this.slots[i].head;
      }
    }
    return undefined;
  }

  get tail(): ResourceRequest<T> | undefined {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      if (this.slots[i].length > 0) {
        return this.slots[i].tail;
      }
    }
    return undefined;
  }
}
