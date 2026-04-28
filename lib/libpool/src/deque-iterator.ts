import type { IDoublyLinkedList } from "./doubly-linked-list.js";
import DoublyLinkedListIterator from "./doubly-linked-list-iterator.js";

class DequeIterator<T> implements Iterator<T> {
  private readonly listIterator: DoublyLinkedListIterator<T>;

  constructor(list: IDoublyLinkedList<T>, reverse: boolean = false) {
    this.listIterator = new DoublyLinkedListIterator(list, reverse);
  }

  public next(): IteratorResult<T, undefined> {
    const result = this.listIterator.next();
    // unwrap the node
    if (result.done) {
      return { done: true, value: undefined };
    }
    return {
      value: result.value.data,
      done: false,
    };
  }

  public reset(): void {
    this.listIterator.reset();
  }

  public remove(): boolean {
    return this.listIterator.remove();
  }
}

export default DequeIterator;
