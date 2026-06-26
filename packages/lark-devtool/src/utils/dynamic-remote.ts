/**
 * Dynamic remote loader for Webpack Module Federation.
 *
 * Loads a remote container from a CDN URL at runtime using:
 * 1. Dynamic <script> injection to fetch remoteEntry.js
 * 2. __webpack_init_sharing__ to initialize the shared scope
 * 3. __webpack_share_scopes__ to join the host's shared modules
 * 4. Container.get() to retrieve the remote module
 *
 * This approach does NOT require static `remotes` config in webpack.
 */

// Webpack runtime types — these are injected by the MF plugin at build time
declare const __webpack_init_sharing__: (shareScope: string) => Promise<void>;
declare const __webpack_share_scopes__: Record<string, unknown>;

interface RemoteContainer {
  init: (shareScope: unknown) => Promise<void>;
  get: (module: string) => unknown;
}

/**
 * Extract the container name from a remoteEntry.js URL.
 * Convention: the container name is the last path segment before "remoteEntry.js".
 * e.g., http://localhost:3300/cdn/lark-demo/remoteEntry.js → "lark_demo"
 */
function extractContainerName(url: string): string {
  const parts = new URL(url).pathname.replace(/\/$/, "").split("/");
  const dir = parts[parts.length - 2] ?? parts[parts.length - 1] ?? "remote";
  // Convert kebab-case to snake_case for global variable name
  return dir.replace(/-/g, "_");
}

/** Track loaded containers to avoid duplicate injection */
const loadedContainers = new Map<string, RemoteContainer>();

/**
 * Resolve a module from a container, handling different return types
 * from container.get() across Webpack versions and init states.
 *
 * container.get() can return:
 * - () => Promise<Module>   — standard MF factory (most common)
 * - Promise<() => Module>   — some Webpack versions wrap the factory in a Promise
 * - Promise<Module>        — already-resolved module (some configs)
 * - Module                 — directly cached module
 */
const isObject = (val: unknown): val is object => typeof val === "object" && val !== null;

const isPromise = (val: unknown): val is Promise<unknown> =>
  isObject(val) && "then" in val && typeof val.then === "function";

/**
 * Recursively resolve a value that might be:
 * - A function (MF factory) → call it and resolve the result
 * - A Promise → await it, then resolve the result
 * - Anything else → return as-is
 */
async function resolveFactory(val: unknown): Promise<unknown> {
  if (typeof val === "function") {
    return resolveFactory(await val());
  }
  if (isPromise(val)) {
    return resolveFactory(await val);
  }
  return val;
}

/**
 * Recursively unwrap ESM default wrappers.
 * MF containers may wrap modules as { default: { default: actual } }.
 * Unwrap while the module is a namespace-like object whose only
 * meaningful export is `default`.
 */
function unwrapDefault(mod: unknown): unknown {
  if (!isObject(mod)) return mod;
  const rec = mod as Record<string, unknown>;
  if (!("default" in rec)) return mod;
  const nonDefault = Object.keys(rec).filter((k) => k !== "default" && k !== "__esModule");
  if (nonDefault.length === 0 && rec["default"] != null) {
    return unwrapDefault(rec["default"]);
  }
  return mod;
}

async function resolveModule<T>(
  container: RemoteContainer,
  moduleName: string,
  containerName: string,
): Promise<T> {
  const result = container.get(moduleName);

  if (result == null) {
    throw new Error(
      `Module "${moduleName}" not found in container "${containerName}". ` +
        `Check the remote's exposes config.`,
    );
  }

  // Resolve the value from container.get(), handling all known patterns:
  //   () => Module            → call factory, get module
  //   () => Promise<Module>   → call factory, await module
  //   Promise<() => Module>   → await, then call factory
  //   Promise<Module>         → await directly
  //   Module                  → use directly
  const module = await resolveFactory(result);

  return unwrapDefault(module) as T;
}

/**
 * Load a remote Module Federation container from a CDN URL.
 *
 * @param containerUrl - Full URL to the remoteEntry.js file
 * @param moduleName   - The exposed module path (e.g., "./counter-view")
 * @returns The remote module's exports
 */
export async function loadRemoteFromCdn<T = unknown>(
  containerUrl: string,
  moduleName: string,
): Promise<T> {
  // Check cache first
  const cached = loadedContainers.get(containerUrl);
  if (cached !== undefined) {
    return resolveModule<T>(cached, moduleName, extractContainerName(containerUrl));
  }

  // 1. Inject <script> to load remoteEntry.js
  const containerName = extractContainerName(containerUrl);

  await new Promise<void>((resolve, reject) => {
    // Check if already loaded via script tag (valid MF container with get method)
    const existing = Reflect.get(window, containerName);
    if (existing !== undefined && typeof Reflect.get(existing, "get") === "function") {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = containerUrl;
    script.type = "text/javascript";
    script.async = true;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load remote entry: ${containerUrl}`));

    document.head.appendChild(script);
  });

  // 2. Get the container from window
  const container = Reflect.get(window, containerName) as RemoteContainer;
  if (container === undefined) {
    throw new Error(
      `Container "${containerName}" not found on window after loading ${containerUrl}`,
    );
  }

  // Validate it's a proper MF container
  if (typeof container.get !== "function" || typeof container.init !== "function") {
    throw new Error(
      `"${containerName}" on window is not a valid MF container. ` +
        `Expected { init, get } but found: ${Object.keys(container).join(", ")}`,
    );
  }

  // 3. Initialize shared scope (idempotent — already done by host's MF runtime)
  await __webpack_init_sharing__("default");

  // 4. Initialize the remote container with our shared scope
  await container.init(__webpack_share_scopes__["default"]);

  // Cache the container
  loadedContainers.set(containerUrl, container);

  // 5. Get and execute the remote module
  return resolveModule<T>(container, moduleName, containerName);
}

/**
 * Clear the cached remote container.
 * Useful for hot-reloading during development.
 */
export function clearRemoteCache(containerUrl?: string): void {
  if (containerUrl !== undefined) {
    loadedContainers.delete(containerUrl);
  } else {
    loadedContainers.clear();
  }
}
