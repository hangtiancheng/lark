interface PendingRequest<T> {
  promise: Promise<T>;
}

export class Throttle {
  private pending: Map<string, PendingRequest<any>> = new Map();

  async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) {
      return existing.promise;
    }
    const promise = fn().finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, { promise });
    return promise;
  }
}
