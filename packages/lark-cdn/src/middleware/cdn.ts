import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import type { Context, Next } from "koa";
import mime from "mime-types";
import { Cache, ByteView } from "@lark.js/cache";
import type { CacheKey, ServerConfig } from "../types/index.js";
import { getProjectConfig } from "../services/config-store.js";
import { parseRoute } from "../utils/route-parser.js";
import { resolveVersion } from "../utils/grayscale.js";
import { resolveSafePath, hasFileExtension, buildCacheKey } from "../utils/path-security.js";
import {
  PrefixIndex,
  serializeCacheEntry,
  deserializeCacheEntry,
} from "../services/cache-utils.js";
import type { CacheEntry } from "../types/index.js";

const HASHED_FILE_RE = /[.-][a-f0-9]{8,}\.\w+$/;

function computeETag(content: Buffer): string {
  return `"${crypto.createHash("md5").update(content).digest("hex")}"`;
}

function getCacheControl(filePath: string): string {
  const basename = path.basename(filePath);
  if (basename === "index.html" || basename === "index.htm") {
    return "no-cache";
  }
  if (HASHED_FILE_RE.test(basename)) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=3600";
}

export function createCdnMiddleware(
  cache: Cache,
  prefixIndex: PrefixIndex,
  config: ServerConfig,
): (ctx: Context, next: Next) => Promise<void> {
  return async (ctx: Context, next: Next): Promise<void> => {
    const parsed = parseRoute(ctx.path, config.cdnPrefix);
    if (parsed === undefined) {
      return next();
    }

    // CORS headers — allow cross-origin access from dev servers (Vite, Webpack, etc.)
    const origin = ctx.get("Origin") || "*";
    ctx.set("Access-Control-Allow-Origin", origin);
    ctx.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    ctx.set("Access-Control-Allow-Headers", "Content-Type");
    ctx.set("Access-Control-Expose-Headers", "ETag, X-Cache, X-CDN-Version, X-Resolution-Source");

    // Handle preflight requests
    if (ctx.method === "OPTIONS") {
      ctx.status = 204;
      return;
    }

    const { projectName, explicitVersion, filePath } = parsed;

    const projectConfig = getProjectConfig(projectName);
    if (projectConfig === undefined) {
      ctx.status = 404;
      ctx.body = { error: `Project "${projectName}" not found` };
      return;
    }

    const headers: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(ctx.headers)) {
      headers[key] = typeof value === "string" ? value : undefined;
    }

    const resolved = resolveVersion(
      projectConfig,
      explicitVersion,
      headers,
      config.grayscaleHeader,
      config.grayscaleCookiePrefix,
    );
    if (resolved === undefined) {
      ctx.status = 404;
      ctx.body = { error: `No available version for project "${projectName}"` };
      return;
    }

    const versionConfig = resolved.config;

    const safePath = resolveSafePath(versionConfig.distPath, filePath);
    if (safePath === undefined) {
      ctx.status = 403;
      ctx.body = { error: "Path traversal detected" };
      return;
    }

    // L1 cache lookup
    const cacheKey: CacheKey = buildCacheKey(projectName, versionConfig.version, filePath);
    const [cachedView, found] = cache.get(cacheKey);
    if (found && cachedView !== null) {
      const cached = deserializeCacheEntry(cachedView);
      const ifNoneMatch = ctx.get("If-None-Match");
      if (ifNoneMatch === cached.etag) {
        ctx.status = 304;
        return;
      }
      ctx.set("Content-Type", cached.contentType);
      ctx.set("Cache-Control", cached.cacheControl);
      ctx.set("ETag", cached.etag);
      ctx.set("X-Cache", "HIT-MEMORY");
      ctx.set("X-CDN-Version", versionConfig.version);
      ctx.set("X-Resolution-Source", resolved.source);
      ctx.body = cached.content;
      return;
    }

    // Disk read with SPA fallback
    let finalPath: string | undefined = safePath;
    let statResult: { size: number; mtimeMs: number } | undefined;

    try {
      const stat = await fs.stat(safePath);
      if (stat.isDirectory()) {
        const indexPath = path.resolve(safePath, "index.html");
        try {
          const indexStat = await fs.stat(indexPath);
          finalPath = indexPath;
          statResult = { size: indexStat.size, mtimeMs: indexStat.mtimeMs };
        } catch {
          finalPath = undefined;
        }
      } else {
        statResult = { size: stat.size, mtimeMs: stat.mtimeMs };
      }
    } catch {
      if (!hasFileExtension(filePath)) {
        const indexPath = resolveSafePath(versionConfig.distPath, "index.html");
        if (indexPath !== undefined) {
          try {
            const indexStat = await fs.stat(indexPath);
            finalPath = indexPath;
            statResult = {
              size: indexStat.size,
              mtimeMs: indexStat.mtimeMs,
            };
          } catch {
            finalPath = undefined;
          }
        }
      } else {
        finalPath = undefined;
      }
    }

    if (finalPath === undefined || statResult === undefined) {
      ctx.status = 404;
      ctx.body = { error: `File not found: ${filePath}` };
      return;
    }

    const contentType = mime.lookup(finalPath) || "application/octet-stream";
    const cacheControl = getCacheControl(finalPath);

    ctx.set("Content-Type", contentType);
    ctx.set("Content-Length", statResult.size.toString());
    ctx.set("Cache-Control", cacheControl);
    ctx.set("X-CDN-Version", versionConfig.version);
    ctx.set("X-Resolution-Source", resolved.source);

    if (statResult.size < config.cacheMaxEntrySize) {
      const content = await fs.readFile(finalPath);
      const etag = computeETag(content);

      const ifNoneMatch = ctx.get("If-None-Match");
      if (ifNoneMatch === etag) {
        ctx.status = 304;
        return;
      }

      ctx.set("ETag", etag);
      ctx.set("X-Cache", "MISS");

      const entry: CacheEntry = {
        content,
        contentType,
        cacheControl,
        etag,
        cachedAt: Date.now(),
        size: statResult.size,
      };
      const serialized = serializeCacheEntry(entry);
      cache.add(cacheKey, new ByteView(serialized));
      prefixIndex.add(cacheKey);
      ctx.body = content;
    } else {
      ctx.set("X-Cache", "MISS-STREAM");
      ctx.body = createReadStream(finalPath);
    }
  };
}
