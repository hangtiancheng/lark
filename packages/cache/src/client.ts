import { PeerGetter } from "./peers.js";

export class HttpClient implements PeerGetter {
  private url: string; // e.g. http://127.0.0.1:8080/cache-js/

  constructor(url: string) {
    this.url = url;
  }

  async get(group: string, key: string): Promise<Buffer> {
    const url = `${this.url}${encodeURIComponent(group)}/${encodeURIComponent(key)}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`status code ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
