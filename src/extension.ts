import * as vscode from 'vscode';
import { activateBatch } from './batchProvider';
import { activateShell } from './shellProvider';

export function activate(context: vscode.ExtensionContext): void {
  activateShell(context);
  activateBatch(context);
}

export function deactivate(): void {
  // context.subscriptions 会自动释放注册的 provider，无需手动清理
}
