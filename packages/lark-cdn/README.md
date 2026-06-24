# @lark.js/cdn

A 1677-line local CDN server that unifies `dist` artifacts from multiple projects in your workspace under a single `/cdn/<project>[@version]/<path>` endpoint. Core features:

- Grayscale release with a 4-level strategy: URL `@version` / header / cookie / weighted random
- MongoDB-backed project and version CRUD (including one-click publish)
- L1 in-memory LRU cache (128 MB default, per-version secondary index with O(k) invalidation)
- SPA fallback (paths without a file extension automatically fall back to index.html)
- chokidar file watching with instant cache clearing on dist changes
- Workspace auto-discovery for dist / dist-vite / dist-webpack artifacts
- Three diagnostic headers: `X-Cache` / `X-CDN-Version` / `X-Resolution-Source`
- Full graceful shutdown (SIGTERM / SIGINT)

Tech stack: Koa 3 + @koa/router 15 + Mongoose 9 + chokidar 5 + pino 10 + zod 4 + TypeScript 5 (strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess).

Intended use cases: local multi-project multi-version development, intranet staging environments, QA environments, offline demos. Not suitable for public-facing production traffic.

## Table of Contents

- 1 Quick Start
- 2 Environment Variables
- 3 URL Routing Format
- 4 Grayscale Version Resolution
- 5 Caching Strategy
- 6 SPA Fallback
- 7 Custom Response Headers
- 8 REST API
- 9 One-Click Publish Workflow
- 10 Workspace Auto-Discovery
- 11 File Watching and Cache Invalidation
- 12 Data Model
- 13 Security and Path Validation
- 14 Comparison with Traditional CDN
- 15 Known Limitations
- 16 Troubleshooting
- 17 Embedding and Extending

---

## 1 Quick Start

Requirements: Node 18+, MongoDB 4+.

### 1.1 Installation

```bash
pnpm install
```

### 1.2 Configuration

```bash
cp .env.example .env
# Edit .env as needed (at minimum confirm CDN_MONGO_URI and CDN_WORKSPACE_ROOT)
```

### 1.3 Starting the Server

```bash
# Development: tsx watch with hot restart
pnpm dev

# Production: compile first, then run
pnpm build
pnpm start
```

Successful startup log:

```
{"level":30,"msg":"Connecting to MongoDB"}
{"level":30,"msg":"MongoDB connected"}
{"level":30,"msg":"Config loaded into memory"}
{"level":30,"msg":"File watcher started"}
{"level":30,"msg":"Server running","port":3300,"cdn":"/cdn","api":"/api"}
```

### 1.4 Verification

```bash
curl http://localhost:3300/api/health
# {"success":true,"data":{"status":"ok","uptime":1.234}}
```

## 2 Environment Variables

All environment variables and their defaults (see `.env.example`):

| Variable                      | Default                              | Description                                                         |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| `CDN_PORT`                    | `3300`                               | HTTP port                                                           |
| `CDN_MONGO_URI`               | `mongodb://localhost:27017/lark-cdn` | MongoDB connection URI                                              |
| `CDN_CACHE_MAX_SIZE`          | `134217728` (128 MB)                 | L1 cache total size limit in bytes                                  |
| `CDN_CACHE_MAX_ENTRY_SIZE`    | `2097152` (2 MB)                     | Max file size for cache entry; larger files stream without caching  |
| `CDN_PREFIX`                  | `/cdn`                               | CDN route prefix                                                    |
| `CDN_API_PREFIX`              | `/api`                               | API route prefix                                                    |
| `CDN_GRAYSCALE_HEADER`        | `x-use-gray`                         | Grayscale header name                                               |
| `CDN_GRAYSCALE_COOKIE_PREFIX` | `cdn_gray_`                          | Grayscale cookie prefix (actual cookie name = prefix + projectName) |
| `CDN_WORKSPACE_ROOT`          | `../` (resolved relative to cwd)     | Root directory for dist auto-discovery                              |
| `LOG_LEVEL`                   | `info`                               | pino log level: trace / debug / info / warn / error / fatal         |

Note: Numeric fields (PORT / CACHE_MAX_SIZE etc.) currently lack invalid-value validation. Passing `abc` produces `NaN` and causes Koa listen to fail. Use `.env` files rather than ad-hoc shell variables.

## 3 URL Routing Format

### 3.1 CDN Routes

```
/<cdnPrefix>/<projectName>[@version]/<filePath>
```

Default `cdnPrefix=/cdn`.

| Example                             | Resolution                                                             |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `/cdn/admin/app.js`                 | project=admin, version=(grayscale decision), filePath=app.js           |
| `/cdn/admin@1.0.0/app.js`           | project=admin, version=1.0.0 (URL explicit), filePath=app.js          |
| `/cdn/admin@canary/assets/main.css` | project=admin, version=canary, filePath=assets/main.css                |
| `/cdn/admin/`                       | project=admin, filePath="" (triggers SPA fallback to index.html)       |
| `/cdn/admin/route/page`             | filePath=route/page; SPA fallback if that file does not exist on disk  |

### 3.2 Naming Constraints

```
projectName regex:  /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/
version regex:      /^[a-zA-Z0-9._-]+$/
```

Project names must start with an alphanumeric character. Version strings allow dots, hyphens, and underscores. Both rules are enforced in the zod schema and the URL parsing regex simultaneously.

### 3.3 API Routes

```
/<apiPrefix>/<endpoint...>
```

Default `apiPrefix=/api`. See section 8 for all endpoints.

## 4 Grayscale Version Resolution

Every CDN request passes through `resolveVersion` to determine which version to serve. Four priority levels:

```
Level 1: URL explicit @version          -> X-Resolution-Source: url-explicit
Level 2: header / cookie match          -> X-Resolution-Source: header-override
Level 3: weighted random (active vers.) -> X-Resolution-Source: weighted-random
Level 4: defaultVersion fallback        -> X-Resolution-Source: default-fallback
```

Note: Level 3 always takes precedence over Level 4. As long as a project has at least one active version, weighted random is used. `defaultVersion` only takes effect when all versions are inactive.

### 4.1 URL Explicit

```bash
curl http://localhost:3300/cdn/admin@1.0.0/app.js
```

When the URL contains `@version`, resolution is direct. If the specified version does not exist in the project, the system gracefully degrades to Level 2/3/4 rather than returning 404.

### 4.2 Header (Two Formats)

Format A: plain string, applies to all projects

```bash
curl -H "x-use-gray: 2.0.0" http://localhost:3300/cdn/admin/app.js
```

Format B: JSON object, per-project (recommended for multi-project scenarios)

```bash
curl -H 'x-use-gray: {"admin":"1.0.0","dashboard":"2.0.0-beta"}' \
     http://localhost:3300/cdn/admin/app.js
```

In Format B, if the current project is not among the JSON keys, resolution falls through to the next level (it does not fall back to treating the value as a plain string).

### 4.3 Cookie

```bash
curl -H "Cookie: cdn_gray_admin=1.0.0" http://localhost:3300/cdn/admin/app.js
```

Cookie name = `${grayscaleCookiePrefix}${projectName}`, default prefix `cdn_gray_`. Priority is lower than header (when both are present, the header takes effect).

### 4.4 Weighted Random

When creating a version via `POST /api/projects/:name/versions`, you can specify `weight` (0-100, default 100). Weighted random distributes traffic proportionally across all `isActive: true` versions by their weight.

Edge cases:

| Scenario                   | Behavior                                   |
| -------------------------- | ------------------------------------------ |
| No active versions         | Level 3 skipped, falls to Level 4 fallback |
| 1 active version           | Returns directly, no randomization         |
| All active versions w=0    | Returns the first active version           |

### 4.5 Actual Role of defaultVersion

Because Level 3 always precedes Level 4, the `defaultVersion` field only takes effect when all versions are `isActive: false`. It is not "the version served when none is specified" but rather "the last-resort fallback when everything is offline."

To make a specific version the default, set its weight to 100 and set other versions' weight to 0 or isActive=false.

## 5 Caching Strategy

### 5.1 L1 In-Memory LRU

```
Default limit:       128 MB
Entry threshold:     < 2 MB (default)
Eviction policy:     LRU (Map iteration order)
Invalidation scope:  per-version (`${project}@${version}:` bucket)
Invalidation cost:   single version O(k), single project O(B*k), full clear O(n)
```

### 5.2 Cache-Control Routing

The server determines `Cache-Control` based on the filename:

| Filename Pattern                                                          | Cache-Control                         |
| ------------------------------------------------------------------------- | ------------------------------------- |
| `index.html` / `index.htm`                                               | `no-cache`                            |
| Contains hash (regex `[.-][a-f0-9]{8,}\.\w+$`, e.g. `app.abc12345.js`)   | `public, max-age=31536000, immutable` |
| All others                                                                | `public, max-age=3600`                |

SPA entry points must use no-cache to enable immediate grayscale switching; hashed files are cached permanently; everything else gets a conservative 1-hour TTL.

### 5.3 ETag and 304

Cached files (< 2 MB) use MD5 strong ETags:

```bash
curl -i http://localhost:3300/cdn/admin/app.js
# ETag: "abc123def456..."

curl -H 'If-None-Match: "abc123def456..."' -i http://localhost:3300/cdn/admin/app.js
# HTTP/1.1 304 Not Modified
```

Streamed large files (>= 2 MB) currently do not emit ETags and do not support 304 negotiation (see known limitation K7).

### 5.4 Cache Invalidation Triggers

| Event                                 | Scope                       |
| ------------------------------------- | --------------------------- |
| chokidar `add` / `change` / `unlink` | Single `${project}@${version}` |
| Version CRUD (POST/PUT/DELETE)        | All versions under project  |
| Project PUT/DELETE                    | All versions under project  |
| POST /api/publish                    | All versions under project  |
| LRU capacity eviction                | Oldest entry individually   |

### 5.5 Cache Statistics

```bash
curl http://localhost:3300/api/cache/stats
```

```json
{
  "success": true,
  "data": {
    "entries": 124,
    "sizeBytes": 18459200,
    "maxSizeBytes": 134217728
  }
}
```

## 6 SPA Fallback

Request paths without a file extension that do not correspond to an existing file on disk automatically fall back to the dist root `index.html`:

```
GET /cdn/admin/route/page
  -> fs.stat(distPath/route/page) ENOENT
  -> hasFileExtension("route/page") = false
  -> falls back to distPath/index.html
```

Requests with a file extension do not trigger fallback: `/cdn/admin/x.js` not found results in a direct 404.

Directory requests like `/cdn/admin/sub/` first stat the directory, then attempt `sub/index.html`, and only return 404 if neither exists.

File extension detection uses `path.basename(filePath).includes(".")`, which correctly handles edge cases like `/path.with.dot/index` where a parent directory contains a dot.

## 7 Custom Response Headers

Every CDN response (200 / 304) includes three custom headers for diagnostics:

| Header                | Values                                                                      | Meaning                                                             |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `X-Cache`             | `HIT-MEMORY` / `MISS` / `MISS-STREAM`                                      | Cache hit / miss (cached) / miss (streamed)                         |
| `X-CDN-Version`       | version string                                                              | Actual version served (may differ from the URL-requested version)   |
| `X-Resolution-Source` | `url-explicit` / `header-override` / `weighted-random` / `default-fallback` | Which resolution level produced the decision                        |

To debug grayscale behavior, simply run `curl -i` and inspect these three headers.

## 8 REST API

All API responses use a unified envelope:

```json
// Success
{ "success": true, "data": <T> }

// Business error (zod validation failure / resource not found / conflict)
{ "success": false, "error": "ValidationError" | "NotFound", "message": "..." }

// Global catch-all (error middleware)
{ "success": false, "error": "Internal Server Error", "message": "..." }
```

### 8.1 Health and Statistics

```
GET  /api/health                    -> { status: "ok", uptime: <seconds> }
GET  /api/cache/stats               -> { entries, sizeBytes, maxSizeBytes }
```

### 8.2 Project CRUD

```
GET    /api/projects                -> ProjectConfig[]
GET    /api/projects/:name          -> ProjectConfig | 404
POST   /api/projects                -> 201 ProjectConfig
PUT    /api/projects/:name          -> ProjectConfig (only description / defaultVersion updatable)
DELETE /api/projects/:name          -> { deleted: true }
```

`POST /api/projects` request body (`ProjectCreateSchema`):

```json
{
  "name": "admin",
  "description": "Admin dashboard",
  "defaultVersion": "1.0.0",
  "versions": [
    {
      "version": "1.0.0",
      "distPath": "/abs/path/to/admin/dist",
      "weight": 100,
      "isActive": true
    }
  ]
}
```

Constraints:

- `name` must match `/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/`
- Each version's `distPath` must be a subpath of `CDN_WORKSPACE_ROOT` (absolute path, validated via `validateDistPath`)
- Duplicate project names return 409

### 8.3 Version CRUD

```
GET    /api/projects/:name/versions                  -> VersionConfig[]
POST   /api/projects/:name/versions                  -> 201 ProjectConfig
PUT    /api/projects/:name/versions/:version         -> ProjectConfig
DELETE /api/projects/:name/versions/:version         -> ProjectConfig
```

`POST /api/projects/:name/versions` request body (`VersionCreateSchema`):

```json
{
  "version": "2.0.0-beta",
  "distPath": "/abs/path/to/admin/dist-vite",
  "weight": 30,
  "isActive": true
}
```

PUT accepts all fields as optional (including version rename). On rename, the watcher automatically transitions from the old key to the new one.

### 8.4 Discovery and Publish

```
GET  /api/discover                  -> DiscoveredDist[]
POST /api/publish                   -> 201 ProjectConfig
```

`GET /api/discover` scans up to 3 levels deep within `CDN_WORKSPACE_ROOT`, skipping 17 common directories (node_modules / .git / .cache / build etc.), and records any `dist-webpack` / `dist-vite` / `dist` directory found as a candidate.

```json
[
  {
    "name": "admin",
    "distPath": "/ws/packages/admin/dist-vite",
    "type": "dist-vite",
    "version": "1.0.0"
  }
]
```

The `version` field is read from `<dist>/../package.json`; if reading fails, it defaults to `"0.0.0"`.

`POST /api/publish` is an idempotent "create or update" endpoint. Request body:

```json
{
  "name": "admin",
  "version": "2.0.0-beta",
  "distPath": "/abs/path/to/admin/dist-vite"
}
```

Behavior:

- Project does not exist: creates project + single version (`weight=100, isActive=true, defaultVersion=version`)
- Project exists but version does not: appends new version (`weight=100, isActive=true`)
- Both project and version exist: updates distPath in place + sets `isActive=true`

Publish does not modify `defaultVersion` on an existing project; use PUT /projects/:name for that.

## 9 One-Click Publish Workflow

Typical flow:

```bash
# 1. Build any sub-project within the workspace
cd /ws/packages/admin && npm run build

# 2. Discover the build artifact
curl -s http://localhost:3300/api/discover | jq
# [ { "name": "admin", "distPath": "/ws/packages/admin/dist-vite", "type": "dist-vite", "version": "1.0.0" } ]

# 3. Publish (automatically creates the project on first run)
curl -X POST http://localhost:3300/api/publish \
  -H 'Content-Type: application/json' \
  -d '{"name":"admin","version":"1.0.0","distPath":"/ws/packages/admin/dist-vite"}'

# 4. Access immediately
curl -i http://localhost:3300/cdn/admin/index.html
# 200 + X-CDN-Version: 1.0.0 + X-Resolution-Source: weighted-random
```

Changes take effect immediately after publish with no restart required. Subsequent file changes within the dist directory are detected by chokidar and the cache is automatically cleared.

## 10 Workspace Auto-Discovery

`GET /api/discover` is implemented in `services/discover.ts`. Key rules:

- Starting point: `CDN_WORKSPACE_ROOT` (default `../` relative to the server process cwd)
- Maximum depth: 3 levels (covers typical monorepo layouts like `packages/foo/dist` and `apps/bar/dist-vite`)
- Skipped directories (17 items): `.cache` `.git` `.pnpm-store` `.vite` `.vscode` `bin` `build` `coverage` `dist` `dist-ssr` `dist-vite` `dist-webpack` `node_modules` `out` `output` `temp` `tmp`
- Candidate dist names (by priority): `dist-webpack` > `dist-vite` > `dist`
- Stops at first match (a single project will not return multiple dist types)
- Version number read from `<dist>/../package.json`

Note: Adding dist directory names to SKIP_DIRS is intentional -- it prevents the scanner from recursing into a project's inner layer and treating it as an independent project (e.g., `proj/dist/sub/dist`).

## 11 File Watching and Cache Invalidation

On startup, `startFileWatcher(cache)` iterates all active versions of all projects and launches an independent chokidar watcher per `${project}@${version}` key.

Watcher configuration:

```ts
chokidar.watch(distPath, {
  ignoreInitial: true, // Do not trigger add on startup (avoids cold-start flood)
  ignored: /(^|[/\\])\.\./, // Ignore hidden files (dot-prefixed)
  persistent: true,
});
```

Events `add` / `change` / `unlink` all invoke the same callback: `invalidateVersionCache(cache, project, version)`, which clears all cache entries for that version (O(k)).

CRUD routes synchronously maintain watchers:

- POST version: `addWatch(cache, name, version)`
- PUT version: `removeWatch(name, oldVersion) + addWatch(cache, name, newVersion ?? oldVersion)`
- DELETE version: `removeWatch(name, version)`
- DELETE project: iterates all versions calling `removeWatch`
- POST /publish: `addWatch(cache, name, version)`

Failure semantics: `removeWatch` silently no-ops on non-existent watchers; callers do not need to check existence first.

## 12 Data Model

MongoDB collection: `projects` (one document = one project, with an embedded versions array).

### 12.1 Project Document

```ts
{
  _id: ObjectId,
  name: string,                 // Unique, matches /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/
  description: string,          // Default ""
  versions: Version[],          // Embedded array
  defaultVersion: string,       // Default "latest"
  createdAt: Date,              // Mongoose timestamps
  updatedAt: Date,
}
```

### 12.2 Version Subdocument

```ts
{
  _id: ObjectId,
  version: string,              // Required, matches /^[a-zA-Z0-9._-]+$/
  distPath: string,             // Required, absolute path, must be a subpath of workspaceRoot
  weight: number,               // 0-100, default 100
  isActive: boolean,            // Default true
  createdAt: number,            // Date.now() milliseconds (note: number, not Date)
}
```

### 12.3 In-Memory ProjectConfig

At runtime, the service does not use Mongoose documents directly. Instead, `toProjectConfig(doc)` converts them to pure-object `ProjectConfig` instances (all readonly fields), stored in a module-level `configMap: Map<name, ProjectConfig>`. On startup, `refreshConfig()` performs a full load; after CRUD operations, `refreshProjectConfig(name)` performs an incremental refresh (copy, mutate, reference-swap -- atomic).

Each CDN request only performs an O(1) in-memory lookup via `getProjectConfig(name)` and never queries the database. The DB is only accessed during CRUD operations.

## 13 Security and Path Validation

### 13.1 Write Side: validateDistPath

All entry points that write a distPath (POST /projects, POST /versions, PUT /versions, POST /publish) enforce `validateDistPath(distPath, workspaceRoot)`:

```ts
const resolved = path.resolve(distPath);
const normalizedRoot = path.resolve(workspaceRoot);
return (
  resolved.startsWith(normalizedRoot + path.sep) || resolved === normalizedRoot
);
```

A distPath outside the workspace is immediately rejected with 400, preventing directories like `/etc` from being registered.

### 13.2 Read Side: resolveSafePath

During CDN request handling, every filePath passes through `resolveSafePath(distPath, filePath)`:

- Normalizes using `path.resolve`
- Validates with `resolved.startsWith(normalizedBase + path.sep)`
- Returns undefined on traversal attempt, resulting in 403 "Path traversal detected"

This defends against URL injection attacks like `../../../../etc/passwd`.

### 13.3 Input Character Set Restrictions

- Project names and version strings are simultaneously constrained by both the URL parsing regex and zod, disallowing slashes, spaces, and special characters
- All request bodies pass through zod safeParse; failures return 400

### 13.4 Capabilities Not Currently Provided

- No IP allowlist, no auth tokens, no CORS domain allowlist (default `origin: "*"` fully open)
- No TLS termination (plaintext HTTP)
- No rate limiting

Therefore, lark-cdn should not be exposed to the public internet or untrusted networks. It is recommended to bind to `127.0.0.1` or add an IP-based firewall.

## 14 Comparison with Traditional CDN

### 14.1 vs Nginx Static Serving

| Dimension        | Nginx               | @lark.js/cdn                              |
| ---------------- | ------------------- | ----------------------------------------- |
| Configuration    | nginx.conf          | MongoDB + REST API                        |
| Multi-version    | rewrite + map       | URL `@version` + header + cookie + weight |
| Grayscale        | split_clients       | Weighted random + per-project header      |
| Caching          | proxy_cache (disk)  | L1 memory (128 MB)                        |
| API management   | Restart / reload    | CRUD takes effect immediately             |
| Range requests   | Full support        | Not supported                             |
| SPA fallback     | try_files           | Built-in                                  |

### 14.2 vs Cloud CDN (Cloudflare / Alibaba Cloud)

| Dimension    | Cloud CDN                 | @lark.js/cdn                |
| ------------ | ------------------------- | --------------------------- |
| Edge nodes   | Globally distributed      | Single machine              |
| TLS          | Termination + cert mgmt   | Not handled                 |
| DDoS         | Built-in                  | None                        |
| Cost         | Pay per traffic           | Free                        |
| Granularity  | By geo / user ID          | By weight / header / cookie |
| Publish      | Via OSS / S3 upload       | Points to local dist        |

### 14.3 When to Use vs When Not to Use

Suitable for: local multi-project development, intranet QA environments, offline demos, educational projects.

Not suitable for: public-facing production traffic, high-availability requirements (no clustering, no failover), large file distribution (no Range support, 128 MB memory cache limit).

## 15 Known Limitations

Listed by priority (see `code-review.md` sections 8/9 for details):

| ID   | Limitation                                                        | Impact                                                            |
| ---- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| K11  | Binds all interfaces by default + no authentication               | Any machine on the LAN can access the service                     |
| K6   | Invalid numeric env vars (`CDN_PORT=abc`) produce NaN crash       | Poor startup experience                                           |
| K2   | `cookie-override` source type reserved but never emitted          | Cookie matches are labeled `header-override`                      |
| K3   | weighted-random always precedes default-fallback                  | `defaultVersion` only effective when all versions are inactive    |
| K5   | `cors({ origin: "*" })` fully open                                | Must be tightened for production deployment                       |
| K7   | Large files (>= 2 MB) streamed without ETag or Range              | Repeated large file requests re-read every time; no 206 support   |
| K8   | No L2 disk cache                                                  | L1 is fully cold after process restart                            |
| K10  | discover scans subdirectories serially                            | Slow on large workspaces                                          |
| K12  | No Prometheus / metrics endpoint                                  | Difficult to integrate with monitoring systems                    |
| K14  | discover assumes `<dist>/../package.json`                         | Fails to find version for deeply nested dist structures           |
| K15  | `findOneAndUpdate` does not run schema validator by default       | Update path bypasses Mongoose validation                          |
| Other| K1 K4 K9 K13 documented in code-review.md                         | Lower impact                                                      |

## 16 Troubleshooting

### 16.1 Startup Hangs at "Connecting to MongoDB"

MongoDB is not running or the URI is incorrect. Verify:

```bash
mongosh mongodb://localhost:27017/lark-cdn --eval 'db.runCommand({ping:1})'
```

### 16.2 GET /cdn/X Returns 404 "Project not found"

The project is not in `configMap`. Verify:

```bash
curl -s http://localhost:3300/api/projects | jq '[.data[].name]'
```

If X is not in the list, you need to POST /api/projects or POST /api/publish first.

### 16.3 GET /cdn/X Returns 404 "No available version"

The project exists but all versions have `isActive: false`. Verify:

```bash
curl -s http://localhost:3300/api/projects/X | jq '.data.versions'
```

### 16.4 Modified dist Files Still Serve Stale Content

Possible causes:

1. chokidar is not watching that version: check startup logs for `"Watching dist","project":"X","version":"Y"`.
2. You modified the directory of an `isActive: false` version: watchers are only started for active versions.
3. Browser cache: hashed files have max-age 31536000. Force refresh with Cmd+Shift+R.

### 16.5 X-Cache Is Always MISS

Possible causes:

1. File size >= `CDN_CACHE_MAX_ENTRY_SIZE` (default 2 MB): check if X-Cache shows MISS-STREAM. Increase that environment variable.
2. chokidar false triggers: some editors write temporary files into the dist directory. Check watcher debug logs.
3. Cache repeatedly evicted: inspect cache.stats to see if sizeBytes approaches maxSizeBytes. Increase `CDN_CACHE_MAX_SIZE`.

### 16.6 Request Returns 403 "Path traversal detected"

The filePath resolved to a location outside the distPath root. Check whether the request URL contains `..` or has been rewritten by a proxy.

### 16.7 After Publish, X-CDN-Version Still Shows Old Version

Weighted random routed you to the old version. Verify:

```bash
# Explicitly request the new version
curl -i http://localhost:3300/cdn/admin@2.0.0-beta/app.js
# X-CDN-Version: 2.0.0-beta + X-Resolution-Source: url-explicit
```

To route all requests to the new version, set the old version's `weight` to 0 or `isActive=false`:

```bash
curl -X PUT http://localhost:3300/api/projects/admin/versions/1.0.0 \
  -H 'Content-Type: application/json' \
  -d '{"isActive":false}'
```

### 16.8 MongoDB Connection / Port Lingers After Process Exit

Under normal SIGTERM/SIGINT, the shutdown handler executes server.close, stopFileWatcher, mongoose.disconnect, then exit 0. If the process is killed with SIGKILL, cleanup does not occur.

## 17 Embedding and Extending

Code structure (17 ts files, 1677 lines):

```
src/
├── index.ts                   # Entry point (main)
├── app.ts                     # Koa app assembly
├── config.ts                  # Environment variable loading
├── middleware/
│   ├── cdn.ts                 # CDN request handler (core)
│   └── error.ts               # Global error catch-all
├── models/
│   └── project.ts             # Mongoose schema + toProjectConfig
├── routes/
│   └── api.ts                 # All REST API endpoints
├── services/
│   ├── config-store.ts        # In-memory configMap + invalidation
│   ├── discover.ts            # Workspace dist auto-discovery
│   ├── file-watcher.ts        # chokidar watching
│   └── memory-cache.ts        # LRU + per-version secondary index
├── types/
│   ├── index.ts               # All interfaces / types
│   └── schemas.ts             # zod schemas
└── utils/
    ├── grayscale.ts           # 4-level grayscale algorithm
    ├── logger.ts              # pino logger
    ├── path-security.ts       # resolveSafePath / buildCacheKey
    └── route-parser.ts        # URL parsing
```

### 17.1 Embedding into Another Koa Application

```ts
import Koa from "koa";
import { createApp } from "@lark.js/cdn/dist/app.js";
import { loadConfig } from "@lark.js/cdn/dist/config.js";
import mongoose from "mongoose";
import { refreshConfig } from "@lark.js/cdn/dist/services/config-store.js";

const config = loadConfig();
await mongoose.connect(config.mongoUri);
await refreshConfig();
const { app, cache } = createApp(config);

// Mount app (Koa instance) as a sub-app within your main Koa application
```

### 17.2 Adding Custom Middleware

`createApp` returns `{ app, cache }`. You can add custom middleware via `app.use(...)` before startup, for example authentication:

```ts
const { app, cache } = createApp(config);
app.use(async (ctx, next) => {
  if (!ctx.path.startsWith("/api/")) return next();
  if (ctx.get("Authorization") !== `Bearer ${process.env.TOKEN}`) {
    ctx.status = 401;
    return;
  }
  await next();
});
```

Note: To insert middleware before `createApiRouter`, you need to modify `app.ts`. Alternatively, wrap it in an outer Koa layer.

### 17.3 Using Core Modules Independently

Each core module is a side-effect-free pure function / class that can be used independently:

```ts
import { parseRoute } from "@lark.js/cdn/dist/utils/route-parser.js";
import { resolveVersion } from "@lark.js/cdn/dist/utils/grayscale.js";
import { LruCache } from "@lark.js/cdn/dist/services/memory-cache.js";
import {
  resolveSafePath,
  buildCacheKey,
} from "@lark.js/cdn/dist/utils/path-security.js";

const parsed = parseRoute("/cdn/admin@1.0.0/app.js", "/cdn");
// { projectName: "admin", explicitVersion: "1.0.0", filePath: "app.js" }
```

### 17.4 Custom Grayscale Strategy

To replace `resolveVersion` with a custom implementation (e.g., user-ID-hash-based routing):

Copy `utils/grayscale.ts`, modify it, and replace the import in `middleware/cdn.ts`. The current architecture does not expose the resolver as an injectable plugin; direct import modification is required.

## License

See `LICENSE` in the repository root.
