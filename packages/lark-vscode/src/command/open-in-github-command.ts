import * as vscode from "vscode";
import * as path from "node:path";
import { execSync } from "node:child_process";

export function registerOpenInGithubCommand(
  context: vscode.ExtensionContext,
  rootPath: string,
): void {
  const command = vscode.commands.registerCommand("lark.openInGithub", (uri?: vscode.Uri) => {
    const filePath = uri?.fsPath ?? vscode.window.activeTextEditor?.document.fileName;
    if (filePath === undefined) {
      return;
    }

    try {
      const repoUrl = getRepositoryUrl(rootPath);
      const branch = getCurrentBranch(rootPath);
      const relativePath = path.relative(rootPath, filePath);
      const isDir = filePath.endsWith(path.sep);
      const type = isDir ? "tree" : "blob";
      const url = `${repoUrl}/${type}/${branch}/${relativePath}`;
      void vscode.env.openExternal(vscode.Uri.parse(url));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      void vscode.window.showErrorMessage(`Failed to open in GitHub: ${message}`);
    }
  });

  context.subscriptions.push(command);
}

function getCurrentBranch(rootPath: string): string {
  const output = execSync("git rev-parse --abbrev-ref HEAD", {
    cwd: rootPath,
    encoding: "utf-8",
  }).trim();
  if (output.length === 0) {
    throw new Error("Could not determine current git branch");
  }
  return output;
}

function getRepositoryUrl(rootPath: string): string {
  const output = execSync("git remote get-url origin", {
    cwd: rootPath,
    encoding: "utf-8",
  }).trim();

  if (output.length === 0) {
    throw new Error("Could not determine git remote URL");
  }

  return normalizeGitUrl(output);
}

function normalizeGitUrl(raw: string): string {
  // SSH format: git@github.com:user/repo.git
  const sshMatch = raw.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch?.[1] !== undefined && sshMatch[2] !== undefined) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }

  // HTTPS format: https://github.com/user/repo.git
  const httpsMatch = raw.match(/^(https?:\/\/.+?)(?:\.git)?$/);
  if (httpsMatch?.[1] !== undefined) {
    return httpsMatch[1];
  }

  throw new Error(`Unrecognized git remote format: ${raw}`);
}
