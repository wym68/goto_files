import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { fileExists } from './utils';

// 匹配 shell 脚本中常见的文件路径：绝对路径 /、家目录 ~/、相对路径 ./ ../
// 排除空白字符和引号，避免误匹配
const PATH_RE = /(?:~\/|\/|\.\.?\/|[\w.-]+\/)[^\s'"]+/g;

/**
 * 展开 ~ 为用户家目录
 */
function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * 将匹配到的路径字符串解析为真实存在的 vscode.Uri
 * 解析顺序：~ 展开 → 绝对路径 → 相对于当前文件目录 → 相对于工作区根目录
 */
async function resolvePath(
  matched: string,
  documentUri: vscode.Uri
): Promise<vscode.Uri | undefined> {
  // 1. expand ~
  if (matched.startsWith('~')) {
    const expanded = expandHome(matched);
    const uri = vscode.Uri.file(expanded);
    if (await fileExists(uri)) {
      return uri;
    }
    return undefined;
  }

  // 2. absolute path
  if (matched.startsWith('/')) {
    const uri = vscode.Uri.file(matched);
    if (await fileExists(uri)) {
      return uri;
    }
    return undefined; // 绝对路径不做后续回退
  }

  // 3. 相对路径：优先相对于当前文件所在目录
  const docDir = path.dirname(documentUri.fsPath);
  const resolvedFromDoc = path.resolve(docDir, matched);
  const uriFromDoc = vscode.Uri.file(resolvedFromDoc);
  if (await fileExists(uriFromDoc)) {
    return uriFromDoc;
  }

  // 4. 回退：相对于工作区第一个根目录
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    const resolvedFromRoot = path.resolve(folders[0].uri.fsPath, matched);
    const uriFromRoot = vscode.Uri.file(resolvedFromRoot);
    if (await fileExists(uriFromRoot)) {
      return uriFromRoot;
    }
  }

  return undefined;
}

export function activateShell(context: vscode.ExtensionContext): void {
  // 仅对 shellscript 语言生效，避免对其他文件类型产生性能影响
  const selector: vscode.DocumentSelector = [
    { language: 'shellscript', scheme: 'file' },
    { language: 'shellscript', scheme: 'untitled' },
  ];

  // ─── DocumentLinkProvider ──────────────────────────────────────────────────
  // provideDocumentLinks：快速扫描文本，返回所有候选范围（不做 IO）
  // resolveDocumentLink：用户真正点击时才做文件存在性检查（懒加载，节省资源）
  const linkProvider = vscode.languages.registerDocumentLinkProvider(selector, {
    provideDocumentLinks(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken
    ): vscode.DocumentLink[] {
      const text = document.getText();
      const links: vscode.DocumentLink[] = [];

      // 每次调用必须重置 lastIndex，避免有状态 regex 跨调用污染
      PATH_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = PATH_RE.exec(text)) !== null) {
        const matched = match[0];
        const start = document.positionAt(match.index);
        const end = document.positionAt(match.index + matched.length);
        const link = new vscode.DocumentLink(new vscode.Range(start, end));
        // 把原始匹配字符串挂到 link 上，供 resolveDocumentLink 使用
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

  // ─── DefinitionProvider ────────────────────────────────────────────────────
  // 支持 F12 / Ctrl+Click（Go to Definition）/ 右键菜单"转到定义"
  const defProvider = vscode.languages.registerDefinitionProvider(selector, {
    async provideDefinition(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken
    ): Promise<vscode.Location | undefined> {
      const lineText = document.lineAt(position.line).text;

      PATH_RE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = PATH_RE.exec(lineText)) !== null) {
        const startCol = match.index;
        const endCol = match.index + match[0].length;

        // 判断光标是否落在该路径范围内
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
