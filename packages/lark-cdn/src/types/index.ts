/**
 * Shared type definitions for the Lark CDN server.
 * All types are strictly typed — zero `any` policy.
 */

// ============================================================
// Version types (in-memory representation)
// ============================================================

/** A single version entry in a project */
export interface VersionConfig {
  /** Version identifier (e.g., "1.0.0", "canary") */
  readonly version: string;
  /** Absolute path to this version's dist directory */
  readonly distPath: string;
  /** Grayscale weight 0-100 (used for weighted random) */
  readonly weight: number;
  /** Whether this version is active (participates in grayscale) */
  readonly isActive: boolean;
  /** Creation timestamp */
  readonly createdAt: number;
}

// ============================================================
// Project types (in-memory representation)
// ============================================================

/** A project's in-memory config (loaded from MongoDB) */
export interface ProjectConfig {
  /** Project name (unique, used as route prefix) */
  readonly name: string;
  /** Project description */
  readonly description: string;
  /** Available versions */
  readonly versions: readonly VersionConfig[];
  /** Default fallback version identifier */
  readonly defaultVersion: string;
}

/** In-memory config map: projectName → ProjectConfig */
export type ConfigMap = ReadonlyMap<string, ProjectConfig>;

// ============================================================
// Route parsing types
// ============================================================

/** Result of parsing a CDN request URL */
export interface ParsedRoute {
  /** Project name extracted from URL */
  readonly projectName: string;
  /** Explicitly requested version (from URL @-syntax), or undefined */
  readonly explicitVersion: string | undefined;
  /** File path within the project's dist directory */
  readonly filePath: string;
}

// ============================================================
// Grayscale resolution types
// ============================================================

/** Resolved version after grayscale calculation */
export interface ResolvedVersion {
  /** The selected version config */
  readonly config: VersionConfig;
  /** How this version was resolved */
  readonly source: VersionResolutionSource;
}

/** How a version was resolved */
export type VersionResolutionSource =
  | "url-explicit"
  | "header-override"
  | "cookie-override"
  | "default-fallback"
  | "weighted-random";

// ============================================================
// Cache types
// ============================================================

/** L1 memory cache entry */
export interface CacheEntry {
  readonly content: Buffer;
  readonly contentType: string;
  readonly cacheControl: string;
  readonly etag: string;
  readonly cachedAt: number;
  readonly size: number;
}

/** Cache key format: "projectName@version:filePath" */
export type CacheKey = `${string}@${string}:${string}`;

// ============================================================
// Server configuration
// ============================================================

/** CDN server configuration */
export interface ServerConfig {
  /** Server port (default: 3300) */
  readonly port: number;
  /** MongoDB connection URI */
  readonly mongoUri: string;
  /** L1 cache max size in bytes (default: 128 MB) */
  readonly cacheMaxSize: number;
  /** L1 cache max entry size in bytes (files larger than this are streamed, default: 2 MB) */
  readonly cacheMaxEntrySize: number;
  /** CDN route prefix (default: "/cdn") */
  readonly cdnPrefix: string;
  /** API route prefix (default: "/api") */
  readonly apiPrefix: string;
  /** Grayscale header name */
  readonly grayscaleHeader: string;
  /** Grayscale cookie prefix */
  readonly grayscaleCookiePrefix: string;
  /** Workspace root directory for auto-discovering dist directories */
  readonly workspaceRoot: string;
}

// ============================================================
// Discovery types
// ============================================================

/** A discovered dist directory in the workspace */
export interface DiscoveredDist {
  /** Project name (derived from directory name) */
  readonly name: string;
  /** Absolute path to the dist directory */
  readonly distPath: string;
  /** Type of dist directory */
  readonly type:
    | "dist"
    | "dist-ssr"
    | "dist-rsbuild"
    | "dist-rollup"
    | "dist-rspack"
    | "dist-tsup"
    | "dist-webpack"
    | "dist-vite";
  /** Version read from dist/package.json, or "0.0.0" if unavailable */
  readonly version: string;
}
