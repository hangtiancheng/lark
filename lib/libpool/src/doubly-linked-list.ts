export interface IDoublyLinkedListNode<T> {
  prev: IDoublyLinkedListNode<T> | null;
  next: IDoublyLinkedListNode<T> | null;
  data: T;
}

export interface IDoublyLinkedList<T> {
  head: IDoublyLinkedListNode<T> | null;
  tail: IDoublyLinkedListNode<T> | null;
  length: number;
  insertBeginning(node: IDoublyLinkedListNode<T>): void;
  insertEnd(node: IDoublyLinkedListNode<T>): void;
  insertAfter(
    node: IDoublyLinkedListNode<T>,
    newNode: IDoublyLinkedListNode<T>,
  ): void;
  insertBefore(
    node: IDoublyLinkedListNode<T>,
    newNode: IDoublyLinkedListNode<T>,
  ): void;
  remove(node: IDoublyLinkedListNode<T>): void;
}

class DoublyLinkedList<T> implements IDoublyLinkedList<T> {
  public head: IDoublyLinkedListNode<T> | null;
  public tail: IDoublyLinkedListNode<T> | null;
  public length: number;

  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  public insertBeginning(node: IDoublyLinkedListNode<T>): void {
    if (this.head === null) {
      this.head = node;
      this.tail = node;
      node.prev = null;
      node.next = null;
      this.length++;
    } else {
      this.insertBefore(this.head, node);
    }
  }

  public insertEnd(node: IDoublyLinkedListNode<T>): void {
    if (this.tail === null) {
      this.insertBeginning(node);
    } else {
      this.insertAfter(this.tail, node);
    }
  }

  public insertAfter(
    node: IDoublyLinkedListNode<T>,
    newNode: IDoublyLinkedListNode<T>,
  ): void {
    newNode.prev = node;
    newNode.next = node.next;
    if (node.next === null) {
      this.tail = newNode;
    } else {
      node.next.prev = newNode;
    }
    node.next = newNode;
    this.length++;
  }

  public insertBefore(
    node: IDoublyLinkedListNode<T>,
    newNode: IDoublyLinkedListNode<T>,
  ): void {
    newNode.prev = node.prev;
    newNode.next = node;
    if (node.prev === null) {
      this.head = newNode;
    } else {
      node.prev.next = newNode;
    }
    node.prev = newNode;
    this.length++;
  }

  public remove(node: IDoublyLinkedListNode<T>): void {
    if (node.prev === null) {
      this.head = node.next;
    } else {
      node.prev.next = node.next;
    }
    if (node.next === null) {
      this.tail = node.prev;
    } else {
      node.next.prev = node.prev;
    }
    node.prev = null;
    node.next = null;
    this.length--;
  }

  public static createNode<T>(data: T): IDoublyLinkedListNode<T> {
    return {
      prev: null,
      next: null,
      data,
    };
  }
}

export default DoublyLinkedList;
