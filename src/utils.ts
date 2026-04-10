import * as vscode from 'vscode';

/**
 * 使用 vscode.workspace.fs 检查 URI 是否存在（支持远程/WSL/容器环境）
 */
export async function fileExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
