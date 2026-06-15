import type { MethodInfo } from "./method-info";

export interface ViewFileInfo {
  readonly filePath: string;
  readonly methods: readonly MethodInfo[];
  readonly mtime: number;
}
