export interface IFactory<T> {
  create(): Promise<T>;
  destroy(client: T): Promise<void>;
  validate?(client: T): Promise<boolean>;
}

function factoryValidator<T>(factory: IFactory<T>) {
  if (typeof factory.create !== "function") {
    throw new TypeError("factory.create must be a function");
  }

  if (typeof factory.destroy !== "function") {
    throw new TypeError("factory.destroy must be a function");
  }

  if (
    typeof factory.validate !== "undefined" &&
    typeof factory.validate !== "function"
  ) {
    throw new TypeError("factory.validate must be a function");
  }
}

export default factoryValidator;
