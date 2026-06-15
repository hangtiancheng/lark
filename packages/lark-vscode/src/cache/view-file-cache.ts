import * as fs from "node:fs";
import * as path from "node:path";
import { log } from "../logger";

const TEMPLATE_IMPORT_REGEX = /import\s+\w+\s+from\s+['"]([^'"]+\.html)['"]/g;

export class ViewFileCache {
  private readonly larkRoots: readonly string[];
  private readonly htmlToTs = new Map<string, string>();
  private readonly tsToHtml = new Map<string, string>();

  constructor(larkRoots: readonly string[]) {
    this.larkRoots = larkRoots;
  }

  scanWorkspace(): void {
    for (const root of this.larkRoots) {
      const srcPath = path.join(root, "src");
      if (!fs.existsSync(srcPath)) {
        log(`src/ directory not found in ${root}, skipping`);
        continue;
      }
      this.scanDirectory(srcPath);
    }
    log(
      `Workspace scan complete: ${String(this.tsToHtml.size)} view file pairs indexed across ${String(this.larkRoots.length)} root(s)`,
    );
  }

  private scanDirectory(dirPath: string): void {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        this.scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ext === ".ts" || ext === ".js") {
          this.indexTsFile(fullPath);
        }
      }
    }
  }

  indexTsFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      this.indexTsContent(content, filePath);
    } catch {
      // file read error, skip
    }
  }

  indexTsContent(content: string, filePath: string): void {
    const oldHtml = this.tsToHtml.get(filePath);
    if (oldHtml !== undefined) {
      this.htmlToTs.delete(oldHtml);
      this.tsToHtml.delete(filePath);
    }

    const htmlPath = this.extractTemplateImport(content, filePath);
    if (htmlPath !== null) {
      this.addMapping(filePath, htmlPath);
    } else {
      const sameNameHtml = filePath.replace(/\.(ts|js)$/, ".html");
      if (fs.existsSync(sameNameHtml)) {
        this.addMapping(filePath, sameNameHtml);
      }
    }
  }

  private extractTemplateImport(content: string, tsFilePath: string): string | null {
    TEMPLATE_IMPORT_REGEX.lastIndex = 0;
    const match = TEMPLATE_IMPORT_REGEX.exec(content);
    if (match?.[1] !== undefined) {
      const importPath = match[1];
      return path.resolve(path.dirname(tsFilePath), importPath);
    }
    return null;
  }

  private addMapping(tsFilePath: string, htmlFilePath: string): void {
    this.htmlToTs.set(htmlFilePath, tsFilePath);
    this.tsToHtml.set(tsFilePath, htmlFilePath);
  }

  removeFile(filePath: string): void {
    const ext = path.extname(filePath);
    if (ext === ".ts" || ext === ".js") {
      const html = this.tsToHtml.get(filePath);
      if (html !== undefined) {
        this.htmlToTs.delete(html);
      }
      this.tsToHtml.delete(filePath);
    } else if (ext === ".html") {
      const ts = this.htmlToTs.get(filePath);
      if (ts !== undefined) {
        this.tsToHtml.delete(ts);
      }
      this.htmlToTs.delete(filePath);
    }
  }

  getTsForHtml(htmlPath: string): string | undefined {
    const mapped = this.htmlToTs.get(htmlPath);
    if (mapped !== undefined) {
      return mapped;
    }
    const tsPath = htmlPath.replace(/\.html$/, ".ts");
    if (fs.existsSync(tsPath)) {
      return tsPath;
    }
    const jsPath = htmlPath.replace(/\.html$/, ".js");
    if (fs.existsSync(jsPath)) {
      return jsPath;
    }
    return undefined;
  }

  findRootForFile(filePath: string): string | undefined {
    for (const root of this.larkRoots) {
      if (filePath.startsWith(root + path.sep) || filePath === root) {
        return root;
      }
    }
    return undefined;
  }
}
