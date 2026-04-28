export class ExtendableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    this.stack = new Error(message).stack ?? message;
  }
}

export class TimeoutError extends ExtendableError {
  constructor(message: string) {
    super(message);
  }
}

export const FACTORY_CREATE_ERROR = "Factory create error";
export const FACTORY_DESTROY_ERROR = "Factory destroy error";
