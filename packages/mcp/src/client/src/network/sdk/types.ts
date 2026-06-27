declare global {
  interface Navigator {
    connection?: NetworkInfo & EventTarget;
  }
}

export type Lang = "en" | "zh";

export enum DiagnosticTaskId {
  NetworkStatus = "network-status",
  LocationCheck = "location-check",
  SpeedTest = "speed-test",
  ApiCheck = "api-check",
  ResourceCheck = "resource-check",
}

export interface DiagnosticResult {
  id: string;
  name: string;
  status: "pending" | "running" | "success" | "failure" | "skipped";
  message?: string;
  details?: unknown;
  error?: string;
  duration?: number;
  recommendation?: string;
  repairStatus?: "idle" | "repairing" | "success" | "failure";
  repair?: () => Promise<boolean>;
}

export interface NetworkInfo {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
}

export interface SpeedTestResult {
  downloadSpeedMbps: number;
  latencyMs?: number;
}

export interface ApiCheckResult {
  url: string;
  status: number;
  ok: boolean;
  timeMs: number;
}

export interface ResourceCheckResult {
  url: string;
  loaded: boolean;
  timeMs: number;
}

export interface LocationInfo {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  isp?: string;
}

export type DiagnosticCallback = (results: DiagnosticResult[]) => void;

export interface CustomTask {
  id: string;
  name: string;
  run: (ctx: SDKOptions) => Promise<unknown>;
  repair?: (ctx: SDKOptions) => Promise<boolean>;
}

export interface SDKOptions {
  lang?: Lang;
  apiList?: string[];
  resourceList?: string[];
  speedTestFileUrl?: string;
  customTasks?: CustomTask[];
  onResultsUpdate?: DiagnosticCallback;
  updateResult?: (id: string, updates: Partial<DiagnosticResult>) => void;
}
