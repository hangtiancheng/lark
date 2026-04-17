import Deque from "./deque.js";
import DoublyLinkedList from "./doubly-linked-list.js";
import ResourceRequest from "./resource-request.js";

export interface IQueueNode<T> {
  prev: IQueueNode<T> | null;
  next: IQueueNode<T> | null;
  data: T;
}

class Queue<T> extends Deque<ResourceRequest<T>> {
  override push(resourceRequest: ResourceRequest<T>): void {
    const node = DoublyLinkedList.createNode(resourceRequest);
    resourceRequest.promise.catch(this.createTimeoutRejectionHandler(node));
    this.list.insertEnd(node);
  }

  private createTimeoutRejectionHandler(
    node: IQueueNode<ResourceRequest<T>>,
  ): (reason?: any) => void {
    return (reason?: any) => {
      if (reason.name === "TimeoutError") {
        this.list.remove(node);
      }
    };
  }
}

export default Queue;
