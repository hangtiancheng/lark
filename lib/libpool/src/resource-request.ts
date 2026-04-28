import Deferred from "./deferred.js";
import { TimeoutError } from "./errors.js";

class ResourceRequest<T> extends Deferred<T> {
  private creationTimestamp: number;
  private timeout: NodeJS.Timeout | null;

  constructor(ttl?: number) {
    super();
    this.creationTimestamp = Date.now();
    this.timeout = null;
    if (ttl !== undefined) {
      this.setTimeout(ttl);
    }
  }

  setTimeout(delay: number): void {
    if (this.state !== Deferred.PENDING) {
      return;
    }
    if (!Number.isInteger(delay) || delay <= 0) {
      throw new Error("Delay must be a positive integer");
    }
    const age = Date.now() - this.creationTimestamp;
    if (this.timeout) {
      this.removeTimeout();
    }
    this.timeout = setTimeout(
      this.fireTimeout.bind(this),
      Math.max(delay - age, 0),
    );
  }

  removeTimeout(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = null;
  }

  private fireTimeout(): void {
    this.reject(new TimeoutError("resource request timed out"));
  }

  override reject(reason?: any): void {
    this.removeTimeout();
    super.reject(reason);
  }

  override resolve(value: T | PromiseLike<T>): void {
    this.removeTimeout();
    super.resolve(value);
  }
}

export default ResourceRequest;
