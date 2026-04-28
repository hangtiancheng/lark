import { Value } from "./lru.js";

export class ByteView implements Value {
  private bytes: Buffer;

  constructor(bytes: Buffer) {
    this.bytes = bytes;
  }

  len(): number {
    return this.bytes.length;
  }

  view(): Buffer {
    return Buffer.from(this.bytes);
  }

  toString(): string {
    return this.bytes.toString();
  }
}
