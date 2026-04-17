export type PooledResourceState =
  | "ALLOCATED"
  | "IDLE"
  | "INVALID"
  | "RETURNING"
  | "VALIDATION";

class PooledResource<T> {
  creationTime: number;
  lastReturnTime: number | undefined;
  lastBorrowTime: number | undefined;
  lastIdleTime: number | undefined;
  obj: T;
  state: PooledResourceState;

  constructor(resource: T) {
    this.creationTime = Date.now();
    this.lastReturnTime = undefined;
    this.lastBorrowTime = undefined;
    this.lastIdleTime = undefined;
    this.obj = resource;
    this.state = "IDLE";
  }

  allocate(): void {
    this.lastBorrowTime = Date.now();
    this.state = "ALLOCATED";
  }

  deallocate(): void {
    this.lastReturnTime = Date.now();
    this.state = "IDLE";
  }

  invalidate(): void {
    this.state = "INVALID";
  }

  test(): void {
    this.state = "VALIDATION";
  }

  idle(): void {
    this.lastIdleTime = Date.now();
    this.state = "IDLE";
  }

  returning(): void {
    this.state = "RETURNING";
  }
}

export default PooledResource;
