import * as vscode from "vscode";
import { findLarkRoots, setLarkContext } from "./activation.js";
import { ViewFileCache } from "./cache/view-file-cache.js";
import { ViewMethodCache } from "./cache/view-method-cache.js";
import { createFileWatchers } from "./watcher/file-watcher.js";
import { registerCopyViewPathCommand } from "./command/copy-view-path-command.js";
import { registerOpenInGithubCommand } from "./command/open-in-github-command.js";
import { LarkDefinitionProvider } from "./provider/definition-provider.js";
import { LarkCompletionProvider } from "./provider/completion-provider.js";
import { LarkFoldingRangeProvider } from "./provider/folding-range-provider.js";
import { LarkImageHoverProvider } from "./provider/hover-provider.js";
import { StatusBarManager } from "./status-bar/status-bar-manager.js";
import { initLogger, log } from "./logger.js";

const HTML_SELECTOR: vscode.DocumentSelector = [{ language: "html", scheme: "file" }];
const TS_JS_SELECTOR: vscode.DocumentSelector = [
  { language: "typescript", scheme: "file" },
  { language: "javascript", scheme: "file" },
];
const ALL_SELECTOR: vscode.DocumentSelector = [...HTML_SELECTOR, ...TS_JS_SELECTOR];

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = initLogger();
  context.subscriptions.push(outputChannel);

  log("Lark vscode extension activating");

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    log("No workspace folders found, skipping activation");
    return;
  }

  const firstFolder = workspaceFolders[0];
  if (firstFolder === undefined) {
    return;
  }
  const workspaceRoot = firstFolder.uri.fsPath;
  log(`Workspace root: ${workspaceRoot}`);

  const larkRoots = findLarkRoots(workspaceRoot);
  const isLark = larkRoots.length > 0;
  setLarkContext(isLark);
  log(
    isLark
      ? `Lark project detected: ${String(larkRoots.length)} root(s) — ${larkRoots.join(", ")}`
      : "Lark project detected: false",
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider("*", new LarkImageHoverProvider()),
  );

  if (!isLark) {
    log("Not a Lark project, only image hover provider registered");
    return;
  }

  const viewFileCache = new ViewFileCache(larkRoots);
  const viewMethodCache = new ViewMethodCache();

  viewFileCache.scanWorkspace();

  const watchers = createFileWatchers(larkRoots, viewFileCache, viewMethodCache);
  for (const w of watchers) {
    context.subscriptions.push(w);
  }

  // Commands
  registerCopyViewPathCommand(context, viewFileCache);
  registerOpenInGithubCommand(context, workspaceRoot);

  // Providers
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      ALL_SELECTOR,
      new LarkDefinitionProvider(viewFileCache, viewMethodCache),
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      HTML_SELECTOR,
      new LarkCompletionProvider(viewFileCache, viewMethodCache),
      "@",
      '"',
      "'",
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(HTML_SELECTOR, new LarkFoldingRangeProvider()),
  );

  const statusBarManager = new StatusBarManager(context);
  statusBarManager.initialize();

  log("Lark vscode extension activated successfully");
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
