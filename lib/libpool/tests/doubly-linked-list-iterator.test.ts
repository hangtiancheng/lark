import { describe, expect, it } from "vitest";
import DoublyLinkedList from "../src/doubly-linked-list.js";
import DoublyLinkedListIterator from "../src/doubly-linked-list-iterator.js";

describe("doubly-linked-list-iterator.test.ts", () => {
  it("test", () => {
    const dll = new DoublyLinkedList<{ id: number }>();

    const node1 = DoublyLinkedList.createNode({ id: 1 });
    const node2 = DoublyLinkedList.createNode({ id: 2 });
    const node3 = DoublyLinkedList.createNode({ id: 3 });
    const node4 = DoublyLinkedList.createNode({ id: 4 });

    dll.insertBeginning(node1);
    dll.insertBeginning(node2);
    dll.insertBeginning(node3);
    dll.insertBeginning(node4);

    const iterator = new DoublyLinkedListIterator<{ id: number }>(dll);

    const iterationResult1 = iterator.next();
    expect(iterationResult1.done).toBe(false);
    expect(iterationResult1.value).toBe(node4);

    iterator.next();
    iterator.next();

    const iterationResult4 = iterator.next();
    expect(iterationResult4.done).toBe(false);
    expect(iterationResult4.value).toBe(node1);

    const iterationResult5 = iterator.next();
    expect(iterationResult5.done).toBe(true);
  });

  it("test2", () => {
    const dll = new DoublyLinkedList<{ id: number }>();

    const node1 = DoublyLinkedList.createNode({ id: 1 });
    const node2 = DoublyLinkedList.createNode({ id: 2 });
    const node3 = DoublyLinkedList.createNode({ id: 3 });
    const node4 = DoublyLinkedList.createNode({ id: 4 });

    dll.insertBeginning(node1);
    dll.insertBeginning(node2);
    dll.insertBeginning(node3);
    dll.insertBeginning(node4);

    const iterator = new DoublyLinkedListIterator<{ id: number }>(dll, true);

    const iterationResult1 = iterator.next();
    expect(iterationResult1.done).toBe(false);
    expect(iterationResult1.value).toBe(node1);

    iterator.next();
    iterator.next();

    const iterationResult4 = iterator.next();
    expect(iterationResult4.done).toBe(false);
    expect(iterationResult4.value).toBe(node4);

    const iterationResult5 = iterator.next();
    expect(iterationResult5.done).toBe(true);
  });

  it("test3", () => {
    const dll = new DoublyLinkedList<{ id: number }>();

    const node1 = DoublyLinkedList.createNode({ id: 1 });
    const node2 = DoublyLinkedList.createNode({ id: 2 });

    const iterator = new DoublyLinkedListIterator<{ id: number }>(dll);

    dll.insertBeginning(node1);
    dll.insertBeginning(node2);

    const iterationResult1 = iterator.next();
    expect(iterationResult1.done).toBe(false);
    expect(iterationResult1.value).toBe(node2);

    const iterationResult2 = iterator.next();
    expect(iterationResult2.done).toBe(false);
    expect(iterationResult2.value).toBe(node1);

    const iterationResult3 = iterator.next();
    expect(iterationResult3.done).toBe(true);
  });

  it("test4", () => {
    const dll = new DoublyLinkedList<{ id: number }>();

    const node1 = DoublyLinkedList.createNode({ id: 1 });
    const node2 = DoublyLinkedList.createNode({ id: 2 });

    const iterator = new DoublyLinkedListIterator<{ id: number }>(dll, true);

    dll.insertBeginning(node1);
    dll.insertBeginning(node2);

    const iterationResult1 = iterator.next();
    expect(iterationResult1.done).toBe(false);
    expect(iterationResult1.value).toBe(node1);

    const iterationResult2 = iterator.next();
    expect(iterationResult2.done).toBe(false);
    expect(iterationResult2.value).toBe(node2);

    const iterationResult3 = iterator.next();
    expect(iterationResult3.done).toBe(true);
  });

  it("should stop iterating when node is detached", () => {
    const dll = new DoublyLinkedList<{ id: number }>();
    const iterator = new DoublyLinkedListIterator<{ id: number }>(dll);

    const node1 = DoublyLinkedList.createNode({ id: 1 });
    const node2 = DoublyLinkedList.createNode({ id: 2 });

    dll.insertBeginning(node1);
    dll.insertBeginning(node2);

    const iterationResult1 = iterator.next();
    expect(iterationResult1.done).toBe(false);
    expect(iterationResult1.value).toBe(node2);

    dll.remove(node1);

    const iterationResult3 = iterator.next();
    expect(iterationResult3.done).toBe(true);
  });
});
