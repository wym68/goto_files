import * as vscode from 'vscode';
import * as path from 'path';
import { fileExists } from './utils';

// 匹配 BAT/CMD 中常见的文件路径：盘符绝对路径、相对路径、无前缀相对路径、环境变量路径
// 支持引号内路径（不包含引号本身），排除 UNC 路径、命令开关和 BAT 特殊参数
export const BAT_PATH_RE = /(?:(?<=")(?:[A-Za-z]:[\\/][^"\r\n]+|\.\.?[\\/][^"\r\n]+|(?<![%~\w.\\/:-])[\w.-]+[\\/][^"\r\n]+|%[A-Za-z_][A-Za-z0-9_]*%[\\/][^"\r\n]+)(?=")|(?<![%~\w.\\/:"])(?:[A-Za-z]:[\\/][^\s'"]+|\.\.?[\\/][^\s'"]+|[\w.-]+[\\/][^\s'"]+|%[A-Za-z_][A-Za-z0-9_]*%[\\/][^\s'"]+))/g;

export function expandEnvironmentVariables(p: string): string {
  return p.replace(
    /%([A-Za-z_][A-Za-z0-9_]*)%/g,
    (match, name) => process.env[name] || match
  );
}

async function resolvePath(
  matched: string,
  documentUri: vscode.Uri
): Promise<vscode.Uri | undefined> {
  const expanded = expandEnvironmentVariables(matched);

  if (/^[A-Za-z]:[\\/]/.test(expanded)) {
    const uri = vscode.Uri.file(expanded);
    if (await fileExists(uri)) {
      return uri;
    }
    return undefined;
  }

  const docDir = path.dirname(documentUri.fsPath);
  const resolvedFromDoc = path.resolve(docDir, expanded);
  const uriFromDoc = vscode.Uri.file(resolvedFromDoc);
  if (await fileExists(uriFromDoc)) {
    return uriFromDoc;
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    const resolvedFromRoot = path.resolve(folders[0].uri.fsPath, expanded);
    const uriFromRoot = vscode.Uri.file(resolvedFromRoot);
    if (await fileExists(uriFromRoot)) {
      return uriFromRoot;
    }
  }

  return undefined;
}

export function activateBatch(context: vscode.ExtensionContext): void {
  const selector: vscode.DocumentSelector = [
    { language: 'bat', scheme: 'file' },
    { language: 'bat', scheme: 'untitled' },
  ];

  const linkProvider = vscode.languages.registerDocumentLinkProvider(selector, {
    provideDocumentLinks(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken
    ): vscode.DocumentLink[] {
      const text = document.getText();
      const links: vscode.DocumentLink[] = [];

      BAT_PATH_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = BAT_PATH_RE.exec(text)) !== null) {
        const matched = match[0];
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + matched.length);
        const link = new vscode.DocumentLink(new vscode.Range(start, end));
        (link as any)._matchedPath = matched;
        (link as any)._documentUri = document.uri;
        links.push(link);
      }

      return links;
    },

    async resolveDocumentLink(
      link: vscode.DocumentLink,
      _token: vscode.CancellationToken
    ): Promise<vscode.DocumentLink> {
      const matched: string | undefined = (link as any)._matchedPath;
      const documentUri: vscode.Uri | undefined = (link as any)._documentUri;

      if (matched && documentUri) {
        const resolved = await resolvePath(matched, documentUri);
        if (resolved) {
          link.target = resolved;
          link.tooltip = `打开: ${resolved.fsPath}`;
        }
      }

      return link;
    },
  });

  const defProvider = vscode.languages.registerDefinitionProvider(selector, {
    async provideDefinition(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken
    ): Promise<vscode.Location | undefined> {
      const lineText = document.lineAt(position.line).text;

      BAT_PATH_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = BAT_PATH_RE.exec(lineText)) !== null) {
        const startCol = match.index;
        const endCol = match.index + match[0].length;

        if (position.character >= startCol && position.character <= endCol) {
          const resolved = await resolvePath(match[0], document.uri);
          if (resolved) {
            return new vscode.Location(resolved, new vscode.Position(0, 0));
          }
          break;
        }
      }

      return undefined;
    },
  });

  context.subscriptions.push(linkProvider, defProvider);
}
