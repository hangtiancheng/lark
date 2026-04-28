type TState = "PENDING" | "FULFILLED" | "REJECTED";

class Deferred<T> {
  public state: TState;
  public promise: Promise<T>;

  private nativeResolve: (value: T | PromiseLike<T>) => void;
  private nativeReject: (reason?: any) => void;

  static PENDING: TState = "PENDING";
  static FULFILLED: TState = "FULFILLED";
  static REJECTED: TState = "REJECTED";

  constructor() {
    this.state = Deferred.PENDING;
    this.nativeResolve = () => {};
    this.nativeReject = () => {};

    this.promise = new Promise((resolve, reject) => {
      this.nativeResolve = resolve;
      this.nativeReject = reject;
    });
  }

  reject(reason?: any): void {
    if (this.state !== Deferred.PENDING) {
      return;
    }
    this.state = Deferred.REJECTED;
    this.nativeReject(reason);
  }

  resolve(value: T | PromiseLike<T>): void {
    if (this.state !== Deferred.PENDING) {
      return;
    }
    this.state = Deferred.FULFILLED;
    this.nativeResolve(value);
  }
}

export default Deferred;
