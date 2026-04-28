import DequeIterator from "./deque-iterator.js";
import DoublyLinkedList, {
  type IDoublyLinkedList,
} from "./doubly-linked-list.js";

class Deque<T> implements Iterable<T> {
  list: IDoublyLinkedList<T>;

  constructor() {
    this.list = new DoublyLinkedList<T>();
  }

  shift(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    const node = this.list.head as any;
    this.list.remove(node);
    return node.data;
  }

  unshift(element: T): void {
    const node = DoublyLinkedList.createNode(element);
    this.list.insertBeginning(node);
  }

  push(element: T): void {
    const node = DoublyLinkedList.createNode(element);
    this.list.insertEnd(node);
  }

  pop(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    const node = this.list.tail as any;
    this.list.remove(node);
    return node.data;
  }

  [Symbol.iterator](): Iterator<T> {
    return new DequeIterator<T>(this.list);
  }

  iterator(): DequeIterator<T> {
    return new DequeIterator<T>(this.list);
  }

  reverseIterator(): DequeIterator<T> {
    return new DequeIterator<T>(this.list, true);
  }

  get head(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    const node = this.list.head;
    return node?.data;
  }

  get tail(): T | undefined {
    if (this.length === 0) {
      return undefined;
    }
    const node = this.list.tail;
    return node?.data;
  }

  get length(): number {
    return this.list.length;
  }
}

export default Deque;
