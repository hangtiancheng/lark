import { EventEmitter } from "events";
import DefaultEvictor, { type IEvictorConfig } from "./default-evictor.js";
import Deferred from "./deferred.js";
import DequeIterator from "./deque-iterator.js";
import Deque from "./deque.js";
import PoolOptions from "./pool-options.js";
import PooledResource from "./poored-resource.js";
import PriorityQueue from "./priority-queue.js";
import factoryValidator, { type IFactory } from "./factory-validator.js";
import ResourceLoan from "./resource-loan.js";
import ResourceRequest from "./resource-request.js";
import type { IOptions } from "./pool-default.js";
import { FACTORY_CREATE_ERROR, FACTORY_DESTROY_ERROR } from "./errors.js";

function reflector<T>(promise: Promise<T>) {
  return promise.then(
    () => {},
    () => {},
  );
}

export default class Pool<T> extends EventEmitter {
  private config: PoolOptions;
  private factory: IFactory<T>;
  private draining: boolean;
  private started: boolean;
  private waitingClientsQueue: PriorityQueue<T>;
  private factoryCreateOperations: Set<Promise<void>>;
  private factoryDestroyOperations: Set<Promise<void>>;
  private availableObjects: Deque<PooledResource<T>>;
  private testOnBorrowResources: Set<PooledResource<T>>;
  private testOnReturnResources: Set<PooledResource<T>>;
  private validationOperations: Set<Promise<boolean>>;
  private allObjects: Set<PooledResource<T>>;
  private resourceLoans: Map<T, ResourceLoan<T>>;
  private evictionIterator: DequeIterator<PooledResource<T>>;
  private evictor: DefaultEvictor<T>;
  private scheduledEviction: NodeJS.Timeout | null;

  constructor(factory: IFactory<T>, options?: IOptions) {
    super();
    factoryValidator(factory);
    this.config = new PoolOptions(options);
    this.factory = factory;
    this.draining = false;
    this.started = false;
    this.waitingClientsQueue = new PriorityQueue<T>(this.config.priorityRange);
    this.factoryCreateOperations = new Set<Promise<void>>();
    this.factoryDestroyOperations = new Set<Promise<void>>();
    this.availableObjects = new Deque<PooledResource<T>>();
    this.testOnBorrowResources = new Set<PooledResource<T>>();
    this.testOnReturnResources = new Set<PooledResource<T>>();
    this.validationOperations = new Set<Promise<boolean>>();
    this.allObjects = new Set<PooledResource<T>>();
    this.resourceLoans = new Map<T, ResourceLoan<T>>();
    this.evictionIterator = this.availableObjects.iterator();
    this.evictor = new DefaultEvictor();
    this.scheduledEviction = null;
    if (this.config.autoStart) {
      this.start();
    }
  }

  private destroyPooledResource(pooledResource: PooledResource<T>): void {
    pooledResource.invalidate();
    this.allObjects.delete(pooledResource);
    const destroyPromise = this.factory.destroy(pooledResource.obj);
    const wrappedDestroyPromise = this.config.destroyTimeoutMilliseconds
      ? Promise.resolve(this.applyDestroyTimeout(destroyPromise))
      : Promise.resolve(destroyPromise);
    this.trackOperation(
      wrappedDestroyPromise,
      this.factoryDestroyOperations,
    ).catch((reason) => {
      this.emit(FACTORY_DESTROY_ERROR, reason);
    });
    this.ensureMinimum();
  }

  private applyDestroyTimeout(promise: Promise<void>): Promise<void> {
    const timeoutPromise = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        reject(new Error("destroy timed out"));
      }, this.config.destroyTimeoutMilliseconds).unref();
    });
    return Promise.race([timeoutPromise, promise]);
  }

  private testOnBorrow(): boolean {
    if (this.availableObjects.length < 1) {
      return false;
    }
    const pooledResource = this.availableObjects.shift();
    if (!pooledResource || !this.factory.validate) {
      return false;
    }
    pooledResource.test();
    this.testOnBorrowResources.add(pooledResource);
    const validationPromise = this.factory.validate(pooledResource.obj);
    const wrappedValidationPromise = Promise.resolve(validationPromise);
    this.trackOperation(
      wrappedValidationPromise,
      this.validationOperations,
    ).then((isValid) => {
      this.testOnBorrowResources.delete(pooledResource);
      if (!isValid) {
        pooledResource.invalidate();
        this.destroyPooledResource(pooledResource);
        this.dispense();
        return;
      }
      this.dispatchPooledResourceToNextWaitingClient(pooledResource);
    });
    return true;
  }

  private dispatchResource(): boolean {
    if (this.availableObjects.length < 1) {
      return false;
    }
    const pooledResource = this.availableObjects.shift();
    if (!pooledResource) {
      return false;
    }
    this.dispatchPooledResourceToNextWaitingClient(pooledResource);
    return false;
  }

  private dispense(): void {
    const numWaitingClients = this.waitingClientsQueue.length;
    if (numWaitingClients < 1) {
      return;
    }
    const resourceShortfall =
      numWaitingClients - this.potentiallyAllocableResourceCount;
    const actualNumberOfResourcesToCreate = Math.min(
      this.spareResourceCapacity,
      resourceShortfall,
    );
    for (let i = 0; i < actualNumberOfResourcesToCreate; i++) {
      this.createResource();
    }
    if (this.config.testOnBorrow) {
      const desiredNumberOfResourcesToMoveIntoTest =
        numWaitingClients - this.testOnBorrowResources.size;
      const actualNumberOfResourcesToMoveIntoTest = Math.min(
        this.availableObjects.length,
        desiredNumberOfResourcesToMoveIntoTest,
      );
      for (let i = 0; i < actualNumberOfResourcesToMoveIntoTest; i++) {
        this.testOnBorrow();
      }
    }

    if (!this.config.testOnBorrow) {
      const actualNumberOfResourcesToDispatch = Math.min(
        this.availableObjects.length,
        numWaitingClients,
      );
      for (let i = 0; i < actualNumberOfResourcesToDispatch; i++) {
        this.dispatchResource();
      }
    }
  }

  private dispatchPooledResourceToNextWaitingClient(
    pooledResource: PooledResource<T>,
  ): boolean {
    const clientResourceRequest = this.waitingClientsQueue.dequeue();
    if (
      clientResourceRequest === undefined ||
      clientResourceRequest.state !== Deferred.PENDING
    ) {
      this.addPooledResourceToAvailableObjects(pooledResource);
      return false;
    }
    const loan = new ResourceLoan(pooledResource);
    this.resourceLoans.set(pooledResource.obj, loan);
    pooledResource.allocate();
    clientResourceRequest.resolve(pooledResource.obj);
    return true;
  }

  private trackOperation<T>(
    operation: Promise<T>,
    set: Set<Promise<T>>,
  ): Promise<T> {
    set.add(operation);
    return operation.then(
      (value) => {
        set.delete(operation);
        return Promise.resolve(value);
      },
      (err) => {
        set.delete(operation);
        return Promise.reject(err);
      },
    );
  }

  private createResource(): void {
    const factoryPromise = this.factory.create();
    const wrappedFactoryPromise = Promise.resolve(factoryPromise).then(
      (resource) => {
        const pooledResource = new PooledResource(resource);
        this.allObjects.add(pooledResource);
        this.addPooledResourceToAvailableObjects(pooledResource);
      },
    );
    this.trackOperation(wrappedFactoryPromise, this.factoryCreateOperations)
      .then(() => {
        this.dispense();
        return null;
      })
      .catch((reason) => {
        this.emit(FACTORY_CREATE_ERROR, reason);
        this.dispense();
      });
  }

  private ensureMinimum(): void {
    if (this.draining) {
      return;
    }
    const minShortfall = this.config.min - this.count;
    for (let i = 0; i < minShortfall; i++) {
      this.createResource();
    }
  }

  private evict(): void {
    const testsToRun = Math.min(
      this.config.numTestsPerEvictionRun,
      this.availableObjects.length,
    );
    const evictionConfig: IEvictorConfig = {
      softIdleTimeoutMilliseconds: this.config.softIdleTimeoutMilliseconds,
      idleTimeoutMilliseconds: this.config.idleTimeoutMilliseconds,
      min: this.config.min,
    };
    for (let testsHaveRun = 0; testsHaveRun < testsToRun; ) {
      const iterationResult = this.evictionIterator.next();
      if (iterationResult.done && this.availableObjects.length < 1) {
        this.evictionIterator.reset();
        return;
      }
      if (iterationResult.done && this.availableObjects.length > 0) {
        this.evictionIterator.reset();
        continue;
      }
      const resource = iterationResult.value;
      if (!resource) {
        continue;
      }
      const shouldEvict = this.evictor.evict(
        evictionConfig,
        resource,
        this.availableObjects.length,
      );
      testsHaveRun++;
      if (shouldEvict) {
        this.evictionIterator.remove();
        this.destroyPooledResource(resource);
      }
    }
  }

  private scheduleEvictorRun(): void {
    if (this.config.evictionRunIntervalMilliseconds > 0) {
      this.scheduledEviction = setTimeout(() => {
        this.evict();
        this.scheduleEvictorRun();
      }, this.config.evictionRunIntervalMilliseconds).unref();
    }
  }

  private descheduleEvictorRun(): void {
    if (this.scheduledEviction) {
      clearTimeout(this.scheduledEviction);
    }
    this.scheduledEviction = null;
  }

  public start(): void {
    if (this.draining) {
      return;
    }
    if (this.started) {
      return;
    }
    this.started = true;
    this.scheduleEvictorRun();
    this.ensureMinimum();
  }

  public acquire(priority?: number): Promise<T> {
    if (!this.started && !this.config.autoStart) {
      this.start();
    }
    if (this.draining) {
      return Promise.reject(
        new Error("pool is draining and cannot accept work"),
      );
    }
    if (
      this.spareResourceCapacity < 1 &&
      this.availableObjects.length < 1 &&
      this.config.maxWaitingClients !== undefined &&
      this.waitingClientsQueue.length >= this.config.maxWaitingClients
    ) {
      console.log("max waiting clients count exceeded");
      return Promise.reject(new Error("max waiting clients count exceeded"));
    }
    const resourceRequest = new ResourceRequest<T>(
      this.config.acquireTimeoutMilliseconds,
    );
    this.waitingClientsQueue.enqueue(resourceRequest, priority);
    this.dispense();
    return resourceRequest.promise;
  }

  public use<U>(
    fn: (resource: T) => Promise<U>,
    priority?: number,
  ): Promise<U> {
    return this.acquire(priority).then((resource) => {
      return fn(resource).then(
        (result) => {
          this.release(resource);
          return result;
        },
        (err) => {
          this.destroy(resource);
          throw err;
        },
      );
    });
  }

  public isBorrowedResource(resource: T): boolean {
    return this.resourceLoans.has(resource);
  }

  public release(resource: T): Promise<void> {
    const loan = this.resourceLoans.get(resource);
    if (loan === undefined) {
      return Promise.reject(
        new Error("resource not currently part of this pool"),
      );
    }
    this.resourceLoans.delete(resource);
    loan.resolve(resource);
    const pooledResource = loan.pooledResource;
    pooledResource.deallocate();
    this.addPooledResourceToAvailableObjects(pooledResource);
    this.dispense();
    return Promise.resolve();
  }

  public destroy(resource: T): Promise<void> {
    const loan = this.resourceLoans.get(resource);
    if (loan === undefined) {
      return Promise.reject(
        new Error("resource not currently part of this pool"),
      );
    }
    this.resourceLoans.delete(resource);
    loan.resolve(resource);
    const pooledResource = loan.pooledResource;
    pooledResource.deallocate();
    this.destroyPooledResource(pooledResource);
    this.dispense();
    return Promise.resolve();
  }

  private addPooledResourceToAvailableObjects(
    pooledResource: PooledResource<T>,
  ): void {
    pooledResource.idle();
    if (this.config.fifo) {
      this.availableObjects.push(pooledResource);
    } else {
      this.availableObjects.unshift(pooledResource);
    }
  }

  public drain(): Promise<void> {
    this.draining = true;
    return this.allResourceRequestsSettled()
      .then(() => {
        return this.allResourcesReturned();
      })
      .then(() => {
        this.descheduleEvictorRun();
      });
  }

  private allResourceRequestsSettled(): Promise<void> {
    if (
      this.waitingClientsQueue.length > 0 &&
      this.waitingClientsQueue.tail !== undefined
    ) {
      return reflector(this.waitingClientsQueue.tail.promise);
    }
    return Promise.resolve();
  }

  private allResourcesReturned(): Promise<void[]> {
    const ps = Array.from(this.resourceLoans.values())
      .map((loan) => loan.promise)
      .map(reflector);
    return Promise.all(ps);
  }

  public clear(): Promise<void> {
    const reflectedCreatePromises = Array.from(
      this.factoryCreateOperations,
    ).map(reflector);

    return Promise.all(reflectedCreatePromises).then(() => {
      for (const resource of this.availableObjects) {
        this.destroyPooledResource(resource);
      }
      const reflectedDestroyPromises = Array.from(
        this.factoryDestroyOperations,
      ).map(reflector);
      return reflector(Promise.all(reflectedDestroyPromises));
    });
  }

  public ready(): Promise<void> {
    return new Promise<void>((resolve) => {
      const isReady = () => {
        if (this.available >= this.min) {
          resolve();
        } else {
          setTimeout(isReady, 100);
        }
      };
      isReady();
    });
  }

  private get potentiallyAllocableResourceCount(): number {
    return (
      this.availableObjects.length +
      this.testOnBorrowResources.size +
      this.testOnReturnResources.size +
      this.factoryCreateOperations.size
    );
  }

  private get count(): number {
    return this.allObjects.size + this.factoryCreateOperations.size;
  }

  public get spareResourceCapacity(): number {
    return (
      this.config.max -
      (this.allObjects.size + this.factoryCreateOperations.size)
    );
  }

  public get size(): number {
    return this.count;
  }

  public get available(): number {
    return this.availableObjects.length;
  }

  public get borrowed(): number {
    return this.resourceLoans.size;
  }

  public get pending(): number {
    return this.waitingClientsQueue.length;
  }

  public get max(): number {
    return this.config.max;
  }

  public get min(): number {
    return this.config.min;
  }
}
