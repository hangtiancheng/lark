import * as vscode from "vscode";
import type { ViewFileCache } from "../cache/view-file-cache.js";
import type { ViewMethodCache } from "../cache/view-method-cache.js";
import { analyzeTemplate } from "../analyzer/template-analyzer.js";
import { parseEventMethodName } from "../model/method-info.js";

const EVENT_TYPES = [
  "click",
  "dblclick",
  "change",
  "input",
  "submit",
  "focus",
  "blur",
  "keyup",
  "keydown",
  "keypress",
  "mouseenter",
  "mouseleave",
  "mouseover",
  "mouseout",
  "mousedown",
  "mouseup",
  "scroll",
  "wheel",
  "contextmenu",
  "touchstart",
  "touchend",
  "touchmove",
] as const;

const AT_EVENT_PREFIX_REGEX = /@$/;
const AT_EVENT_VALUE_REGEX = /@\w+\s*=\s*["']$/;
const TEMPLATE_VAR_REGEX = /\{\{[=!:@]\s*$/;

export class LarkCompletionProvider implements vscode.CompletionItemProvider {
  private readonly viewFileCache: ViewFileCache;
  private readonly viewMethodCache: ViewMethodCache;

  constructor(viewFileCache: ViewFileCache, viewMethodCache: ViewMethodCache) {
    this.viewFileCache = viewFileCache;
    this.viewMethodCache = viewMethodCache;
  }

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionList | null> {
    const lineText = document.lineAt(position).text.slice(0, position.character);

    if (AT_EVENT_PREFIX_REGEX.test(lineText)) {
      return this.provideEventTypeCompletions();
    }

    if (AT_EVENT_VALUE_REGEX.test(lineText)) {
      return this.provideHandlerCompletions(document);
    }

    if (TEMPLATE_VAR_REGEX.test(lineText)) {
      return this.provideVariableCompletions(document);
    }

    return null;
  }

  private provideEventTypeCompletions(): vscode.CompletionList {
    const items = EVENT_TYPES.map((eventType) => {
      const item = new vscode.CompletionItem(eventType, vscode.CompletionItemKind.Event);
      item.insertText = new vscode.SnippetString(`${eventType}="\${1:handler}(\${2})"`);
      item.detail = `@${eventType} event binding`;
      return item;
    });

    return new vscode.CompletionList(items, false);
  }

  private async provideHandlerCompletions(
    document: vscode.TextDocument,
  ): Promise<vscode.CompletionList | null> {
    const tsPath = this.viewFileCache.getTsForHtml(document.fileName);
    if (tsPath === undefined) {
      return null;
    }

    const viewInfo = await this.viewMethodCache.resolve(tsPath);
    if (viewInfo === null) {
      return null;
    }

    const items = viewInfo.methods.map((method) => {
      const { handlerName } = parseEventMethodName(method.name);
      const item = new vscode.CompletionItem(handlerName, vscode.CompletionItemKind.Method);
      item.insertText = new vscode.SnippetString(`${handlerName}(\${1})`);
      item.detail = method.eventType !== null ? `${method.name} (event handler)` : method.name;
      return item;
    });

    return new vscode.CompletionList(items, false);
  }

  private async provideVariableCompletions(
    document: vscode.TextDocument,
  ): Promise<vscode.CompletionList | null> {
    const source = document.getText();
    const analysis = analyzeTemplate(source);

    if (analysis.variables.length === 0) {
      return null;
    }

    const items = analysis.variables.map((variable) => {
      const item = new vscode.CompletionItem(variable, vscode.CompletionItemKind.Variable);
      item.detail = "template variable";
      return item;
    });

    return new vscode.CompletionList(items, false);
  }
}
