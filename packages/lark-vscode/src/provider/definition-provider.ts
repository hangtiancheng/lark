import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import type { ViewFileCache } from "../cache/view-file-cache";
import type { ViewMethodCache } from "../cache/view-method-cache";
import { analyzeTemplate } from "../analyzer/template-analyzer";
import { log } from "../logger";

const TEMPLATE_IMPORT_REGEX = /import\s+\w+\s+from\s+['"]([^'"]+\.html)['"]/;

export class LarkDefinitionProvider implements vscode.DefinitionProvider {
  private readonly viewFileCache: ViewFileCache;
  private readonly viewMethodCache: ViewMethodCache;

  constructor(viewFileCache: ViewFileCache, viewMethodCache: ViewMethodCache) {
    this.viewFileCache = viewFileCache;
    this.viewMethodCache = viewMethodCache;
  }

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location | null> {
    const line = document.lineAt(position).text;
    const languageId = document.languageId;

    if (languageId === "html") {
      return this.provideHtmlDefinition(document, position, line);
    }

    if (languageId === "typescript" || languageId === "javascript") {
      return this.provideTsDefinition(document, position, line);
    }

    return null;
  }

  private async provideHtmlDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    line: string,
  ): Promise<vscode.Location | null> {
    const vLarkResult = this.resolveVLark(document, line, position);
    if (vLarkResult !== null) {
      return vLarkResult;
    }

    const eventResult = await this.resolveEventHandler(document, position, line);
    if (eventResult !== null) {
      return eventResult;
    }

    return null;
  }

  private resolveVLark(
    document: vscode.TextDocument,
    line: string,
    position: vscode.Position,
  ): vscode.Location | null {
    const analysis = analyzeTemplate(line);
    if (analysis.viewRefs.length === 0) {
      return null;
    }

    for (const ref of analysis.viewRefs) {
      const valueStart = line.indexOf(ref.path);
      if (valueStart === -1) continue;
      const valueEnd = valueStart + ref.path.length;

      if (position.character < valueStart || position.character > valueEnd) {
        continue;
      }

      const root = this.viewFileCache.findRootForFile(document.fileName);
      if (root === undefined) {
        return null;
      }

      log(`v-lark definition: resolving "${ref.path}" from root ${root}`);
      const srcDir = path.join(root, "src");

      for (const ext of [".ts", ".js", ".html"]) {
        const candidate = path.join(srcDir, ref.path + ext);
        if (fs.existsSync(candidate)) {
          return new vscode.Location(vscode.Uri.file(candidate), new vscode.Position(0, 0));
        }
      }
    }

    return null;
  }

  private async resolveEventHandler(
    document: vscode.TextDocument,
    position: vscode.Position,
    line: string,
  ): Promise<vscode.Location | null> {
    const analysis = analyzeTemplate(line);
    if (analysis.events.length === 0) {
      return null;
    }

    for (const event of analysis.events) {
      const handlerStart = line.indexOf(event.handlerName, line.indexOf(`@${event.eventType}`));
      if (handlerStart === -1) continue;
      const handlerEnd = handlerStart + event.handlerName.length;

      if (position.character < handlerStart || position.character > handlerEnd) {
        continue;
      }

      const tsPath = this.viewFileCache.getTsForHtml(document.fileName);
      if (tsPath === undefined) {
        return null;
      }

      const viewInfo = await this.viewMethodCache.resolve(tsPath);
      if (viewInfo === null) {
        return null;
      }

      const candidates = [`${event.handlerName}<${event.eventType}>`, event.handlerName];
      log(`Event handler definition: resolving "${event.handlerName}" for @${event.eventType}`);

      for (const candidate of candidates) {
        const method = viewInfo.methods.find((m) => m.name === candidate);
        if (method !== undefined) {
          return this.createLocationFromOffset(tsPath, method.byteOffset);
        }
      }
    }

    return null;
  }

  private async provideTsDefinition(
    _document: vscode.TextDocument,
    _position: vscode.Position,
    line: string,
  ): Promise<vscode.Location | null> {
    const importMatch = TEMPLATE_IMPORT_REGEX.exec(line);
    if (importMatch?.[1] !== undefined) {
      const importPath = importMatch[1];
      const resolved = path.resolve(path.dirname(_document.fileName), importPath);
      if (fs.existsSync(resolved)) {
        return new vscode.Location(vscode.Uri.file(resolved), new vscode.Position(0, 0));
      }
    }

    return null;
  }

  private createLocationFromOffset(filePath: string, byteOffset: number): vscode.Location {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const charOffset = byteOffsetToCharOffset(content, byteOffset);
      let line = 0;
      let col = 0;
      for (let i = 0; i < charOffset && i < content.length; i++) {
        if (content[i] === "\n") {
          line++;
          col = 0;
        } else {
          col++;
        }
      }
      return new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(line, col));
    } catch {
      return new vscode.Location(vscode.Uri.file(filePath), new vscode.Position(0, 0));
    }
  }
}

function byteOffsetToCharOffset(content: string, byteOffset: number): number {
  const encoder = new TextEncoder();
  let bytes = 0;
  for (let i = 0; i < content.length; i++) {
    if (bytes >= byteOffset) return i;
    const code = content.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else {
      bytes += 3;
    }
  }
  return content.length;
}
