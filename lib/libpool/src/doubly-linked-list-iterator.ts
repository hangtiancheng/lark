import type {
  IDoublyLinkedList,
  IDoublyLinkedListNode,
} from "./doubly-linked-list.js";

class DoublyLinkedListIterator<T> implements Iterator<
  IDoublyLinkedListNode<T>
> {
  private readonly list: IDoublyLinkedList<T>;
  private readonly direction: "prev" | "next";
  private readonly startPosition: "tail" | "head";
  private started: boolean;
  private cursor: IDoublyLinkedListNode<T> | null;
  private done: boolean;

  constructor(
    doublyLinkedList: IDoublyLinkedList<T>,
    reverse: boolean = false,
  ) {
    this.list = doublyLinkedList;
    this.direction = reverse ? "prev" : "next";
    this.startPosition = reverse ? "tail" : "head";
    this.started = false;
    this.cursor = null;
    this.done = false;
  }

  private start(): void {
    this.cursor = this.list[this.startPosition];
    this.started = true;
  }

  private advanceCursor(): void {
    if (!this.started) {
      this.start();
      return;
    }
    this.cursor = this.cursor?.[this.direction] ?? null;
  }

  reset(): void {
    this.done = false;
    this.started = false;
    this.cursor = null;
  }

  remove(): boolean {
    if (
      !this.started ||
      this.done ||
      this.cursor === null ||
      this.isCursorDetached()
    ) {
      return false;
    }
    this.list.remove(this.cursor);
    return true;
  }

  next(): IteratorResult<IDoublyLinkedListNode<T>, undefined> {
    if (this.done) {
      return { done: true, value: undefined };
    }
    this.advanceCursor();
    if (this.cursor === null || this.isCursorDetached()) {
      this.done = true;
      return { done: true, value: undefined };
    }
    return {
      done: false,
      value: this.cursor,
    };
  }

  private isCursorDetached(): boolean {
    if (this.cursor === null) {
      return true;
    }
    return (
      this.cursor.prev === null &&
      this.cursor.next === null &&
      this.list.tail !== this.cursor &&
      this.list.head !== this.cursor
    );
  }
}

export default DoublyLinkedListIterator;
