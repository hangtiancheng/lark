import * as fs from "node:fs";
import { analyzeViewFile } from "../analyzer/view-analyzer";
import type { ViewFileInfo } from "../model/view-file-info";

const MAX_CACHE_SIZE = 500;

export class ViewMethodCache {
  private readonly cache = new Map<string, ViewFileInfo>();
  private readonly accessOrder: string[] = [];

  async resolve(filePath: string): Promise<ViewFileInfo | null> {
    const cached = this.cache.get(filePath);
    if (cached !== undefined) {
      this.touch(filePath);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs === cached.mtime) {
          return cached;
        }
      } catch {
        // stat failed, reparse
      }
    }

    const info = await analyzeViewFile(filePath);
    if (info !== null) {
      this.set(filePath, info);
    }
    return info;
  }

  set(filePath: string, info: ViewFileInfo): void {
    if (this.cache.size >= MAX_CACHE_SIZE && !this.cache.has(filePath)) {
      this.evict();
    }
    this.cache.set(filePath, info);
    this.touch(filePath);
  }

  remove(filePath: string): void {
    this.cache.delete(filePath);
    const idx = this.accessOrder.indexOf(filePath);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }

  private touch(filePath: string): void {
    const idx = this.accessOrder.indexOf(filePath);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(filePath);
  }

  private evict(): void {
    const oldest = this.accessOrder.shift();
    if (oldest !== undefined) {
      this.cache.delete(oldest);
    }
  }
}
