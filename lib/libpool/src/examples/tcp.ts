import { Socket, createConnection } from "net";

export enum ConnectionState {
  IDLE = "IDLE",
  ALLOCATED = "ALLOCATED",
  DESTROYED = "DESTROYED",
}

export class TcpConnection {
  public state = ConnectionState.IDLE;
  private socket?: Socket | undefined = undefined;
  private errorHooks: Set<(error: Error) => void> = new Set();
  private handleClose?: () => void;
  private handleError?: (error: Error) => void;
  private handleSendClose?: () => void;
  private handleSendError?: (error: Error) => void;
  private handleConnect?: () => void;
  private handleData?: (data: Buffer) => void;
  private handleTimeout?: () => void;

  constructor(
    private remoteHost: string,
    private remotePort: number,
    private defaultTimeout: number,
  ) {}

  onError(hook: (error: Error) => void) {
    this.errorHooks.add(hook);
  }

  initialize(): Promise<TcpConnection> {
    return new Promise<TcpConnection>((resolve, reject) => {
      const cleanup = () => {
        if (this.handleConnect) {
          this.socket?.removeListener("connect", this.handleConnect);
        }
        if (this.handleError) {
          this.socket?.removeListener("error", this.handleError);
        }
        if (this.handleClose) {
          this.socket?.removeListener("close", this.handleClose);
        }
      };

      this.handleError = (error: Error) => {
        cleanup();
        this.triggerError(error);
        reject(error);
      };

      this.handleClose = () => {
        cleanup();
        const error = new Error(
          "TCP connection has been closed unexpectedly during initialization",
        );
        this.triggerError(error);
        reject(error);
      };

      if (this.state === ConnectionState.DESTROYED) {
        const error = new Error("TCP connection has been destroyed");
        this.handleError(error);
        return;
      }

      this.socket = createConnection(this.remotePort, this.remoteHost);
      // For decreasing latency.
      this.socket.setNoDelay();

      this.handleConnect = () => {
        cleanup();
        this.handleClose = () => {
          this.triggerError(
            new Error("TCP connection has been closed unexpectedly"),
          );
        };
        this.handleError = (error: Error) => {
          this.triggerError(error);
        };
        this.socket?.on("error", this.handleError);
        this.socket?.on("close", this.handleClose);
        resolve(this);
      };

      this.socket.once("connect", this.handleConnect);
      this.socket.once("close", this.handleClose);
      // feat: this.socket.on => this.socket.once
      this.socket.once("error", this.handleError);
    });
  }

  async executeTask<T>(
    data: Buffer | string | object,
    timeout?: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.socket || this.state === ConnectionState.DESTROYED) {
        reject(new Error("TCP connection has been destroyed or is undefined"));
        return;
      }
      this.state = ConnectionState.ALLOCATED;
      const dataPackets: Buffer[] = [];

      // Convert data to Buffer
      let sendData: Buffer;
      if (data instanceof Buffer) {
        sendData = data;
      } else if (typeof data === "string") {
        sendData = Buffer.from(data);
      } else {
        sendData = Buffer.from(JSON.stringify(data));
      }

      const cleanup = () => {
        this.socket?.setTimeout(0);
        if (this.handleData) {
          this.socket?.removeListener("data", this.handleData);
        }
        if (this.handleSendError) {
          this.socket?.removeListener("error", this.handleSendError);
        }
        if (this.handleTimeout) {
          this.socket?.removeListener("timeout", this.handleTimeout);
        }
        if (this.handleClose) {
          this.socket?.removeListener("close", this.handleClose);
        }
        this.state = ConnectionState.IDLE;
      };

      this.handleSendError = (error: Error) => {
        // this.triggerError(error); // triggerError is called in `handleError`
        cleanup();
        this.state = ConnectionState.DESTROYED;
        reject(error);
      };

      this.handleTimeout = () => {
        const error = new Error("TCP connection has timed out");
        this.handleSendError?.(error);
      };

      this.handleSendClose = () => {
        const error = new Error("TCP connection closed during task execution");
        this.handleSendError?.(error);
      };

      this.handleData = (packet: Buffer) => {
        dataPackets.push(packet);
        if (packet.subarray(-1)[0] === "\r".charCodeAt(0)) {
          try {
            const data: T = JSON.parse(Buffer.concat(dataPackets).toString());
            cleanup();
            resolve(data);
          } catch (error) {
            this.handleSendError?.(
              error instanceof Error ? error : new Error(JSON.stringify(error)),
            );
          }
        }
      };

      this.socket.setTimeout(timeout ?? this.defaultTimeout);
      this.socket.once("close", this.handleSendClose);
      this.socket.once("error", this.handleSendError);
      this.socket.on("data", this.handleData);
      this.socket.once("timeout", this.handleTimeout);

      this.socket.write(sendData, (error) => {
        if (error) {
          this.handleSendError?.(error);
        }
      });
    });
  }

  private triggerError(error: Error) {
    Array.from(this.errorHooks).forEach((hook) => hook(error));
  }

  destroy() {
    this.state = ConnectionState.DESTROYED;
    this.socket?.removeAllListeners();
    // Clear error hooks
    this.errorHooks.clear();
    try {
      this.socket?.destroy();
    } finally {
      this.socket = undefined;
    }
  }

  isValid() {
    return (
      this.state === "IDLE" &&
      this.socket !== undefined &&
      !this.socket.destroyed &&
      this.socket.readyState === "open" &&
      this.socket.readable &&
      this.socket.writable
    );
  }
}
