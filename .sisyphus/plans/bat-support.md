# 添加 Windows BAT 文件路径跳转支持

## TL;DR

> **Quick Summary**: 为 VSCode 插件 "Goto Files" 添加 Windows BAT/CMD 文件中的路径识别与跳转功能，同时将现有单文件架构重构为模块化结构。
> 
> **Deliverables**:
> - `src/utils.ts` — 共享工具函数（fileExists）
> - `src/shellProvider.ts` — Shell 脚本路径识别模块（从 extension.ts 提取）
> - `src/batchProvider.ts` — BAT/CMD 路径识别模块（新建）
> - `src/extension.ts` — 精简入口文件
> - `test/test.bat` — BAT 路径手动测试文件
> - 更新 `package.json`、`README.md`、`README_ZH.md`
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (utils) → Task 2 (shell重构) → Task 3 (bat模块) → Task 4 (test.bat) → Task 5 (docs)

---

## Context

### Original Request
用户希望为现有的 VSCode 插件 "Goto Files"（目前仅支持 Linux sh 文件中的路径跳转）添加对 Windows BAT 文件的相同功能支持。

### Interview Summary
**Key Discussions**:
- **路径格式**: 支持基础 Windows 路径 + 环境变量展开（`%USERPROFILE%` 等）
- **代码架构**: 独立模块分离（shellProvider.ts + batchProvider.ts），而非合并逻辑
- **测试策略**: 添加 test.bat 手动测试文件，与现有 test.sh 风格一致
- **共享逻辑**: 仅提取 `fileExists()` 到 utils.ts，`resolvePath` 各模块独立实现

**Research Findings**:
- 当前插件：单文件 `src/extension.ts`（170行），仅激活于 `onLanguage:shellscript`
- VSCode 中 BAT 文件的 languageId 是 `bat`（同时覆盖 `.bat` 和 `.cmd`）
- `path.resolve` / `path.join` 在 Windows 上自动处理混合斜杠
- 环境变量展开需要手动实现：`input.replace(/%([^%]+)%/g, ...)`

### Metis Review
**Identified Gaps** (addressed):
- **引号内路径处理**: BAT 中 `copy "C:\My Documents\file.txt"` 很常见，正则需要处理引号内路径但不包含引号
- **命令开关误匹配**: `/Y`、`/?` 等不能被识别为路径，需要要求路径包含至少一层目录结构
- **`%~dp0` 和 `%%i` 排除**: BAT 特殊参数语法不应被当作环境变量
- **带空格的未引号路径**: `C:\Program Files\app.exe` 是已知限制，文档说明
- **UNC 路径**: 不在本次范围内
- **Shell 提供器回归**: 重构后必须确保 sh 文件行为完全不变

---

## Work Objectives

### Core Objective
在不影响现有 Shell 脚本功能的前提下，为 BAT/CMD 文件添加 Ctrl+Click 和 F12 路径跳转支持，并将代码重构为可维护的模块化架构。

### Concrete Deliverables
- BAT/CMD 文件中路径变为可点击链接（DocumentLinkProvider）
- BAT/CMD 文件中路径支持 F12 跳转（DefinitionProvider）
- 支持的路径类型：盘符绝对路径、相对路径（`.\ ..\ ./ ../`）、无前缀相对路径、`%VAR%` 环境变量路径
- 模块化代码结构：utils.ts + shellProvider.ts + batchProvider.ts + extension.ts

### Definition of Done
- [ ] `npm run compile` 零错误
- [ ] Shell provider 模块正确导出 activateShell，PATH_RE 与原始完全一致（回归验证）
- [ ] BAT provider 模块正确导出 activateBatch、BAT_PATH_RE、expandEnvironmentVariables，正则匹配所有 4 种路径模式并排除 BAT 参数/命令开关
- [ ] `npx vsce package` 成功生成 .vsix 文件

### Must Have
- BAT 文件中的盘符绝对路径识别（`C:\...` 和 `C:/...`）
- BAT 文件中的相对路径识别（`.\`、`..\`、`./`、`../`、`dir\file`、`dir/file`）
- BAT 文件中的 `%VAR%` 环境变量路径展开
- Shell 脚本功能零回归
- 模块化代码结构

### Must NOT Have (Guardrails)
- ❌ 不修改现有 `PATH_RE` 正则表达式
- ❌ 不支持 PowerShell (.ps1) 文件
- ❌ 不支持 UNC 路径 (`\\server\share`)
- ❌ 不添加自动化测试框架（保持手动测试文件模式）
- ❌ 不添加 webpack/esbuild 构建
- ❌ 不更改现有中文 tooltip 风格
- ❌ 不支持 BAT 标签跳转（`:label` / `goto :label`）
- ❌ 不支持命令路径解析（`where cmd.exe`）
- ❌ 不创建 CHANGELOG.md
- ❌ 不修改版本号（保持 0.0.1）
- ❌ 不处理 `%~dp0`、`%%i` 等 BAT 特殊参数语法（应被正则排除）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.
> **注意**: "ZERO HUMAN INTERVENTION" 指所有 QA 场景和验证步骤由 agent 自动执行，无需用户手动操作。
> Final Verification Wave 完成后，agent 会将结果汇总呈现给用户，用户确认后标记工作完成。
> 用户确认是流程管理步骤，不是 QA 验证步骤。

### Test Decision
- **Infrastructure exists**: NO（项目无自动化测试框架）
- **Automated tests**: None（保持现有手动测试文件模式）
- **Framework**: None

### QA Policy
每个任务必须包含 agent 可执行的 QA 场景。
Evidence 保存到 `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`。

- **编译验证**: Bash 运行 `npm run compile`
- **模块加载验证**: Bash (node -e) 加载编译后的模块，验证导出和正则行为
- **源码验证**: Grep/Read 工具检查源码内容和结构
- **打包验证**: Bash 运行 `npx vsce package`

> **注意**: 由于 VSCode Extension Development Host 是 Electron 桌面应用，Playwright 浏览器自动化无法操控。
> 因此本计划的 QA 策略以**编译验证 + 模块加载测试 + 源码分析**为主要验证手段，
> 而非 UI 层面的 Ctrl+Click/F12 交互测试。Ctrl+Click/F12 的实际行为依赖于
> VSCode DocumentLinkProvider 和 DefinitionProvider API 的正确注册和路径解析逻辑，
> 这些可以通过模块加载和正则匹配测试间接验证。

### Evidence 写入约定（所有 QA 场景适用）

每个 QA 场景完成后，执行 agent 必须将验证输出保存到指定的 evidence 路径。

**写入流程**：
1. **创建目录**：首次写入前，运行 `mkdir -p .sisyphus/evidence`（或 PowerShell 等效命令 `New-Item -ItemType Directory -Path .sisyphus/evidence -Force`）
2. **捕获输出**：将每个验证命令的标准输出和结果判定写入对应的 evidence 文件
3. **格式**：纯文本，包含执行命令、输出内容、PASS/FAIL 判定

**Evidence 文件示例**：
```
# Evidence: task-3-bat-regex-absolute
# Timestamp: 2026-04-09T17:00:00
# Command: node -e "..."
# Output: {"abs_bs":true,"abs_fs":true,"switch_Y":false,"switch_q":false}
# Expected: {"abs_bs":true,"abs_fs":true,"switch_Y":false,"switch_q":false}
# Verdict: PASS
```

**Final Verification 的 F1 将检查这些文件是否存在**，因此每个任务的执行 agent 必须在 QA 完成后写入 evidence。

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation):
├── Task 1: 提取共享 utils.ts [quick]
└── Task 4: 创建 test.bat 测试文件 [quick]

Wave 2 (After Task 1 — core modules, PARALLEL):
├── Task 2: 重构 shellProvider.ts (depends: 1) [unspecified-high]
└── Task 3: 新建 batchProvider.ts (depends: 1) [unspecified-high]

Wave 3 (After Wave 2 — integration + docs):
├── Task 5: 更新 extension.ts 入口 + package.json (depends: 2, 3) [quick]
└── Task 6: 更新 README 文档 (depends: 5) [writing]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 (utils.ts) | — | 2, 3 | 1 |
| 4 (test.bat) | — | F3 | 1 |
| 2 (shellProvider) | 1 | 5 | 2 |
| 3 (batchProvider) | 1 | 5 | 2 |
| 5 (extension.ts + pkg) | 2, 3 | 6 | 3 |
| 6 (README) | 5 | — | 3 |

### Agent Dispatch Summary

- **Wave 1**: 2 tasks — T1 → `quick`, T4 → `quick`
- **Wave 2**: 2 tasks — T2 → `unspecified-high`, T3 → `unspecified-high`
- **Wave 3**: 2 tasks — T5 → `quick`, T6 → `writing`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. 提取共享工具函数到 `src/utils.ts`

  **What to do**:
  - 新建 `src/utils.ts`
  - 从 `src/extension.ts` 提取 `fileExists()` 函数到 `utils.ts`，并导出
  - 函数签名保持不变：`async function fileExists(uri: vscode.Uri): Promise<boolean>`
  - 确保 `utils.ts` 只包含真正共享的工具函数，不包含 shell 或 batch 特有逻辑

  **Must NOT do**:
  - 不提取 `resolvePath`（shell 和 batch 的解析逻辑不同，各自独立）
  - 不提取 `expandHome`（shell 特有）
  - 不修改 `fileExists` 的行为逻辑

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的函数提取，单文件创建，改动量极小
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None needed for simple extraction

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: Task 2, Task 3
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/extension.ts:22-29` — 现有 `fileExists()` 函数实现，原样提取

  **API/Type References**:
  - `src/extension.ts:1-3` — 所需的 import 语句（vscode）

  **WHY Each Reference Matters**:
  - `extension.ts:22-29`: 这是需要原样搬迁的函数，不改任何逻辑
  - `extension.ts:1-3`: utils.ts 只需要 `import * as vscode from 'vscode'`

  **Acceptance Criteria**:
  - [ ] `src/utils.ts` 文件已创建
  - [ ] `fileExists` 函数从 `utils.ts` 正确导出
  - [ ] `npm run compile` 零错误（注意：此时 extension.ts 可能还在引用本地的 fileExists，编译会通过因为还没删除）

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: utils.ts 编译成功且导出正确
    Tool: Bash
    Preconditions: 项目已 npm install
    Steps:
      1. 运行 `npm run compile`
      2. 检查 `out/utils.js` 文件是否存在
      3. 在 `out/utils.js` 中搜索 `exports.fileExists` 确认导出
    Expected Result: 编译零错误，out/utils.js 存在且包含 fileExists 导出
    Failure Indicators: 编译报错，或 out/utils.js 不存在，或无 fileExists 导出
    Evidence: .sisyphus/evidence/task-1-utils-compile.txt

  Scenario: utils.ts 不包含非共享逻辑
    Tool: Bash (grep)
    Preconditions: src/utils.ts 已创建
    Steps:
      1. 在 src/utils.ts 中搜索 `expandHome` — 不应存在
      2. 在 src/utils.ts 中搜索 `resolvePath` — 不应存在
      3. 在 src/utils.ts 中搜索 `PATH_RE` — 不应存在
    Expected Result: 三个搜索均无匹配
    Failure Indicators: 任何搜索有匹配
    Evidence: .sisyphus/evidence/task-1-utils-no-leaks.txt
  ```

  **Commit**: YES (groups with Task 2 — Commit #1)
  - Message: `refactor: extract shared utils and shell provider into separate modules`
  - Files: `src/utils.ts`
  - Pre-commit: `npm run compile`

- [ ] 2. 重构 Shell 提供器到 `src/shellProvider.ts`

  **What to do**:
  - 新建 `src/shellProvider.ts`
  - 从 `src/extension.ts` 迁移以下内容：
    - `PATH_RE` 正则常量（**原样不动**）
    - `expandHome()` 函数
    - Shell 特有的 `resolvePath()` 函数（处理 `~`、`/`、相对路径）
    - Shell 的 `DocumentLinkProvider` 和 `DefinitionProvider` 注册逻辑
  - 从 `src/utils.ts` 导入 `fileExists`
  - 导出一个 `activateShell(context: vscode.ExtensionContext): void` 函数
  - Shell 的 `DocumentSelector` 保持不变：`[{ language: 'shellscript', scheme: 'file' }, { language: 'shellscript', scheme: 'untitled' }]`
  - 保持现有的 `(link as any)._matchedPath` 和 `(link as any)._documentUri` 模式
  - 更新 `src/extension.ts`：删除所有迁出的代码，改为 `import { activateShell } from './shellProvider'` 并在 `activate()` 中调用

  **Must NOT do**:
  - 不修改 `PATH_RE` 正则表达式的模式
  - 不改变 `expandHome` 的逻辑
  - 不改变 `resolvePath` 的解析顺序（`~` → 绝对 → 相对于文档目录 → 相对于工作区根）
  - 不改变 provider 的注册方式（保持匿名对象风格，非 class）
  - 不给 shell provider 添加 Windows 路径识别能力

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 多文件重构需要仔细保持行为一致性，有回归风险
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None — 纯代码搬迁，无需特殊技能

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3, after Task 1)
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/extension.ts:7` — `PATH_RE` 正则常量定义，需原样迁移
  - `src/extension.ts:12-17` — `expandHome()` 函数，需原样迁移
  - `src/extension.ts:35-77` — `resolvePath()` 函数，需原样迁移
  - `src/extension.ts:79-166` — `activate()` 函数中的 selector、linkProvider、defProvider 定义及注册逻辑，需提取为 `activateShell()`

  **API/Type References**:
  - `src/utils.ts` — 将从此导入 `fileExists`

  **WHY Each Reference Matters**:
  - `extension.ts:7`: PATH_RE 是 shell 路径识别的核心，必须原样搬迁不改动
  - `extension.ts:12-17`: expandHome 是 shell 特有功能（`~` 展开），不应共享
  - `extension.ts:35-77`: resolvePath 包含 shell 特有的解析逻辑（`~/`、`/` 开头判断），必须完整搬迁
  - `extension.ts:79-166`: 两个 provider 的注册方式是匿名对象风格 `{ provideDocumentLinks() {} }`，新模块必须保持此风格

  **Acceptance Criteria**:
  - [ ] `src/shellProvider.ts` 文件已创建，包含 PATH_RE、expandHome、resolvePath、activateShell
  - [ ] `src/extension.ts` 精简为入口：导入并调用 activateShell
  - [ ] `npm run compile` 零错误
  - [ ] Shell 脚本路径跳转功能完全不变（回归零）

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: 重构后 Shell 路径跳转回归验证
    Tool: Bash
    Preconditions: npm run compile 成功
    Steps:
      1. 运行 `npm run compile` 确认编译通过
      2. 检查 `out/shellProvider.js` 存在
      3. 检查 `out/extension.js` 中包含 `require("./shellProvider")` 或类似导入
      4. 在 `src/shellProvider.ts` 中搜索 PATH_RE，确认正则为 `/(?:~\/|\/|\.\.?\/|[\w.-]+\/)[^\s'"]+/g`（与原始完全一致）
    Expected Result: 编译通过，shellProvider 被正确导入，PATH_RE 未被修改
    Failure Indicators: 编译报错，或 PATH_RE 被修改
    Evidence: .sisyphus/evidence/task-2-shell-refactor-compile.txt

  Scenario: extension.ts 不再包含业务逻辑
    Tool: Bash (grep)
    Preconditions: 重构完成
    Steps:
      1. 在 src/extension.ts 中搜索 `PATH_RE` — 不应存在
      2. 在 src/extension.ts 中搜索 `expandHome` — 不应存在
      3. 在 src/extension.ts 中搜索 `resolvePath` — 不应存在
      4. 在 src/extension.ts 中搜索 `DocumentLinkProvider` — 不应存在
      5. 确认 src/extension.ts 包含 `activateShell`（导入调用）
    Expected Result: extension.ts 只保留导入和激活调用，无业务逻辑
    Failure Indicators: 仍存在业务逻辑代码
    Evidence: .sisyphus/evidence/task-2-extension-clean.txt
  ```

  **Commit**: YES (Commit #1 — 与 Task 1 一起提交)
  - Message: `refactor: extract shared utils and shell provider into separate modules`
  - Files: `src/utils.ts`, `src/shellProvider.ts`, `src/extension.ts`
  - Pre-commit: `npm run compile`

- [ ] 3. 新建 BAT 路径提供器 `src/batchProvider.ts`

  **What to do**:
  - 新建 `src/batchProvider.ts`
  - 实现 `BAT_PATH_RE` 正则，匹配以下路径模式：
    1. **盘符绝对路径**: `C:\folder\file.txt`、`D:/folder/file.txt`（`[A-Za-z]:[/\\]` 开头）
    2. **点号相对路径**: `.\file`、`..\file`、`./file`、`../file`（`\.\.?[/\\]` 开头）
    3. **无前缀相对路径**: `folder\file`、`folder/file`（`[\w.-]+[/\\]` 后跟更多路径）
    4. **环境变量路径**: `%USERPROFILE%\file`、`%APPDATA%\config`（`%[A-Za-z_][A-Za-z0-9_]*%` 开头后跟路径）
  - 正则必须**排除**：
    - 命令开关：`/Y`、`/?`、`/D` 等（单字符 `/X` 模式）
    - BAT 参数：`%1`-`%9`、`%*`、`%%i`
    - BAT 特殊变量：`%~dp0`、`%~f1` 等（`%~` 开头的）
  - 实现 `expandEnvironmentVariables(p: string): string` 函数：
    - 使用 `p.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (match, name) => process.env[name] || match)` 
    - 对于未定义的变量，保持原文不做替换（路径将因 fileExists 检查而不生成链接）
  - 实现 BAT 特有的 `resolvePath()` 函数，解析链：
    1. 环境变量展开 → 检查是否为绝对路径（盘符开头）
    2. 绝对路径 → 直接用 `vscode.Uri.file()`
    3. 相对路径 → 先相对于当前文件目录 → 再回退到工作区根目录
  - 实现并注册 BAT 的 `DocumentLinkProvider` 和 `DefinitionProvider`
  - DocumentSelector: `[{ language: 'bat', scheme: 'file' }, { language: 'bat', scheme: 'untitled' }]`
  - 导出 `activateBatch(context: vscode.ExtensionContext): void`
  - 同时导出 `BAT_PATH_RE` 和 `expandEnvironmentVariables`（供 QA 验证使用，也方便未来扩展）
  - 从 `src/utils.ts` 导入 `fileExists`
  - 保持与 shellProvider 相同的代码风格：匿名对象 provider、`(link as any)._matchedPath` 模式、中文 tooltip（`打开: ${resolved.fsPath}`）

  **Must NOT do**:
  - 不处理 UNC 路径 (`\\server\share`)
  - 不处理 `%~dp0` 等特殊 BAT 参数（正则应排除）
  - 不给正则添加 PowerShell 语法支持
  - 不修改 shellProvider.ts 或 utils.ts
  - 不处理 BAT 标签（`:label` / `goto :label`）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 新模块开发，需要设计正则、路径解析逻辑，有一定复杂度
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None — TypeScript 开发，无需特殊技能

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2, after Task 1)
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/extension.ts:89-132` — DocumentLinkProvider 的 provideDocumentLinks + resolveDocumentLink 模式（两阶段设计：扫描不做 IO，点击时才检查文件存在），bat provider 应遵循完全相同的结构
  - `src/extension.ts:136-163` — DefinitionProvider 的 provideDefinition 模式（光标位置检测 + 路径解析），bat provider 应遵循完全相同的结构
  - `src/extension.ts:7` — `PATH_RE` 正则常量定义风格参考（bat provider 应以类似方式定义 `BAT_PATH_RE`）
  - `src/extension.ts:79-84` — `selector` 和 `activate` 函数的导出模式参考，bat provider 应导出类似的 `activateBatch(context)` 函数

  **API/Type References**:
  - `src/utils.ts` — 导入 `fileExists`（Task 1 完成后可用）
  - Node.js `process.env` — 用于环境变量展开
  - Node.js `path.resolve()`, `path.join()` — 路径拼接（自动处理混合斜杠）

  **External References**:
  - VSCode API: `vscode.languages.registerDocumentLinkProvider` — 注册链接提供器
  - VSCode API: `vscode.languages.registerDefinitionProvider` — 注册定义提供器

  **WHY Each Reference Matters**:
  - `extension.ts:89-132`: DocumentLinkProvider 的两阶段设计（provideDocumentLinks 不做 IO，resolveDocumentLink 做文件检查）是性能关键模式，必须复用
  - `extension.ts:136-163`: DefinitionProvider 的光标位置检测逻辑是核心交互模式
  - `extension.ts:7`: 正则定义风格参考，bat provider 的 BAT_PATH_RE 应保持一致的定义方式
  - `extension.ts:79-84`: 模块导出和激活模式参考
  - `process.env`: 环境变量展开的数据源
  - `path.resolve/join`: Windows 上自动处理 `/` 和 `\` 混合，无需手动转换

  **Acceptance Criteria**:
  - [ ] `src/batchProvider.ts` 文件已创建
  - [ ] `BAT_PATH_RE` 正则能匹配 4 种路径模式
  - [ ] `BAT_PATH_RE` 不匹配 `/Y`、`%%i`、`%~dp0`
  - [ ] `expandEnvironmentVariables` 正确展开 `%USERPROFILE%` 等变量
  - [ ] `activateBatch`、`BAT_PATH_RE`、`expandEnvironmentVariables` 三个符号均正确导出
  - [ ] `npm run compile` 零错误

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: BAT 正则匹配盘符绝对路径
    Tool: Bash (node -e)
    Preconditions: npm run compile 成功，BAT_PATH_RE 和 expandEnvironmentVariables 已从 batchProvider 导出
    Steps:
      1. 运行 `node -e "const m = require('./out/batchProvider'); function t(s) { const re = new RegExp(m.BAT_PATH_RE.source, m.BAT_PATH_RE.flags); return re.test(s); } console.log(JSON.stringify({ abs_bs: t('C:\\\\Users\\\\test\\\\file.txt'), abs_fs: t('D:/folder/file.txt'), switch_Y: t('/Y'), switch_q: t('/?') }))"`
      2. 验证输出为 `{"abs_bs":true,"abs_fs":true,"switch_Y":false,"switch_q":false}`
    Expected Result: 盘符绝对路径匹配为 true，命令开关匹配为 false
    Failure Indicators: 绝对路径返回 false，或命令开关返回 true
    Evidence: .sisyphus/evidence/task-3-bat-regex-absolute.txt

  Scenario: BAT 正则匹配环境变量路径并排除 BAT 参数
    Tool: Bash (node -e)
    Preconditions: npm run compile 成功
    Steps:
      1. 运行 `node -e "const m = require('./out/batchProvider'); function t(s) { const re = new RegExp(m.BAT_PATH_RE.source, m.BAT_PATH_RE.flags); return re.test(s); } console.log(JSON.stringify({ env_up: t('%USERPROFILE%\\\\Documents\\\\file.txt'), env_ad: t('%APPDATA%\\\\config'), tilde_dp0: t('%~dp0'), double_pct: t('%%i'), param1: t('%1') }))"`
      2. 验证输出为 `{"env_up":true,"env_ad":true,"tilde_dp0":false,"double_pct":false,"param1":false}`
    Expected Result: 环境变量路径匹配为 true，BAT 参数匹配为 false
    Failure Indicators: 环境变量路径返回 false，或 BAT 参数返回 true
    Evidence: .sisyphus/evidence/task-3-bat-regex-envvar.txt

  Scenario: 环境变量展开功能验证
    Tool: Bash (node -e)
    Preconditions: npm run compile 成功
    Steps:
      1. 运行 `node -e "const m = require('./out/batchProvider'); const result1 = m.expandEnvironmentVariables('%USERPROFILE%\\\\test'); const expected1 = process.env.USERPROFILE + '\\\\test'; const result2 = m.expandEnvironmentVariables('%NONEXISTENT_VAR_12345%\\\\test'); console.log(JSON.stringify({ known_ok: result1 === expected1, unknown_ok: result2 === '%NONEXISTENT_VAR_12345%\\\\test' }))"`
      2. 验证输出为 `{"known_ok":true,"unknown_ok":true}`
    Expected Result: 已知变量正确展开 (known_ok: true)，未知变量保持原样 (unknown_ok: true)
    Failure Indicators: 任一结果为 false
    Evidence: .sisyphus/evidence/task-3-env-expand.txt

  Scenario: BAT 正则匹配相对路径和无前缀路径
    Tool: Bash (node -e)
    Preconditions: npm run compile 成功
    Steps:
      1. 运行 `node -e "const m = require('./out/batchProvider'); function t(s) { const re = new RegExp(m.BAT_PATH_RE.source, m.BAT_PATH_RE.flags); return re.test(s); } console.log(JSON.stringify({ dot_bs: t('.\\\\script.bat'), dotdot_bs: t('..\\\\config.ini'), dot_fs: t('./script.bat'), prefix_bs: t('subdir\\\\file.txt'), prefix_fs: t('subdir/file.txt') }))"`
      2. 验证输出为 `{"dot_bs":true,"dotdot_bs":true,"dot_fs":true,"prefix_bs":true,"prefix_fs":true}`
    Expected Result: 所有 5 种相对路径格式匹配为 true
    Failure Indicators: 任一结果为 false
    Evidence: .sisyphus/evidence/task-3-bat-regex-relative.txt
  ```

  **Commit**: YES (Commit #2)
  - Message: `feat: add Windows batch file path navigation support`
  - Files: `src/batchProvider.ts`
  - Pre-commit: `npm run compile`

- [x] 4. 创建 BAT 手动测试文件 `test/test.bat`

  **What to do**:
  - 新建 `test/test.bat`
  - 包含各种路径类型的测试用例，每种用注释标注预期行为：
    - 相对路径（正斜杠）：`type .\test0.py` — 应跳转
    - 相对路径（正斜杠）：`type ./test0.py` — 应跳转
    - 无前缀相对路径（反斜杠）：`type test_1\test1.py` — 应跳转
    - 无前缀相对路径（正斜杠）：`type test_1/test1.py` — 应跳转
    - 多层相对路径：`type .\test_1\test_2\test2.py` — 应跳转
    - 多层正斜杠：`type ./test_1/test_2/test2.py` — 应跳转
    - 环境变量路径：`echo %USERPROFILE%\Desktop` — 取决于文件是否存在
    - 不应匹配的：命令开关 `xcopy /Y`、BAT 参数 `echo %1`、标签 `goto :end`
  - 参考 `test/test.sh` 的风格编写头部注释

  **Must NOT do**:
  - 不修改现有的 test.sh、test0.py 等测试文件
  - 不在 test.bat 中引用不存在的绝对路径（Windows 盘符路径因环境不同难以通用）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单文件创建，内容简单，无逻辑复杂度
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: F3 (Final QA)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `test/test.sh` — 参考 shell 测试文件的整体风格和头部注释格式
  - `test/test_1/` — 现有测试目录结构，bat 测试文件需引用这些相同的测试文件

  **WHY Each Reference Matters**:
  - `test/test.sh`: 保持测试文件风格一致性（头部注释、路径引用方式）
  - `test/test_1/`: bat 测试需引用同一组实际存在的文件来验证跳转功能

  **Acceptance Criteria**:
  - [ ] `test/test.bat` 文件已创建
  - [ ] 包含所有路径类型的测试用例（反斜杠相对、正斜杠相对、无前缀、环境变量）
  - [ ] 包含不应匹配的负面用例（命令开关、BAT 参数、标签）
  - [ ] 引用的相对路径文件确实存在于 test/ 目录中

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: test.bat 文件内容完整性检查
    Tool: Bash (grep)
    Preconditions: test/test.bat 已创建
    Steps:
      1. 确认文件包含 `.\test0.py` 或 `.\test0.py`（反斜杠相对路径）
      2. 确认文件包含 `test_1\test1.py` 或 `test_1/test1.py`（无前缀相对路径）
      3. 确认文件包含 `%USERPROFILE%`（环境变量路径）
      4. 确认文件包含 `@REM` 或 `REM` 注释
      5. 确认引用的 test0.py、test_1/test1.py 文件实际存在
    Expected Result: 所有路径类型和注释均存在，引用的文件存在
    Failure Indicators: 缺少某种路径类型或引用了不存在的文件
    Evidence: .sisyphus/evidence/task-4-test-bat-content.txt

  Scenario: test.bat 不会破坏现有测试文件
    Tool: Bash (git diff)
    Preconditions: test/test.bat 已创建
    Steps:
      1. 运行 `git diff test/test.sh` — 应无变更
      2. 运行 `git diff test/test0.py` — 应无变更
      3. 确认 test/test_1/ 目录未被修改
    Expected Result: 现有测试文件零变更
    Failure Indicators: 任何现有测试文件被修改
    Evidence: .sisyphus/evidence/task-4-no-regression.txt
  ```

  **Commit**: YES (Commit #3)
  - Message: `test: add test.bat with sample Windows paths for manual verification`
  - Files: `test/test.bat`
  - Pre-commit: `npm run compile`

- [ ] 5. 更新 `extension.ts` 入口 + `package.json` 配置

  **What to do**:
  - 更新 `src/extension.ts`：
    - 添加 `import { activateBatch } from './batchProvider'`
    - 在 `activate()` 函数中调用 `activateBatch(context)`
  - 更新 `package.json`：
    - `activationEvents` 添加 `"onLanguage:bat"`
    - `description` 更新为涵盖 shell 和 batch："Ctrl+Click to open file paths in shell scripts and batch files"
    - `keywords` 添加 `"bat"`, `"batch"`, `"cmd"`, `"windows"`

  **Must NOT do**:
  - 不修改版本号（保持 0.0.1）
  - 不添加 `contributes` 配置（无需）
  - 不修改 `engines`、`devDependencies` 等其他字段

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的导入添加和 JSON 字段更新
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 2 and 3)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 6
  - **Blocked By**: Task 2, Task 3

  **References**:

  **Pattern References**:
  - `src/extension.ts` — 重构后的入口文件，需添加 batch 导入和调用
  - `package.json:21-23` — 现有 activationEvents 配置

  **API/Type References**:
  - `src/batchProvider.ts` — 将从此导入 `activateBatch`

  **WHY Each Reference Matters**:
  - `extension.ts`: 入口文件，需在此集成 batch provider
  - `package.json:21-23`: 需要在现有 activationEvents 数组中追加 `onLanguage:bat`

  **Acceptance Criteria**:
  - [ ] `src/extension.ts` 中导入并调用了 `activateBatch`
  - [ ] `package.json` 的 `activationEvents` 包含 `"onLanguage:bat"`
  - [ ] `package.json` 的 `keywords` 包含 `"bat"`, `"batch"`, `"cmd"`, `"windows"`
  - [ ] `package.json` 的 `description` 提及 batch files
  - [ ] `npm run compile` 零错误

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: 完整功能编译验证
    Tool: Bash
    Preconditions: Task 1-4 均完成
    Steps:
      1. 运行 `npm run compile` — 应零错误
      2. 检查 `out/extension.js` 包含 `require("./batchProvider")`
      3. 检查 `out/batchProvider.js` 存在
      4. 检查 `out/shellProvider.js` 存在
      5. 检查 `out/utils.js` 存在
    Expected Result: 所有模块编译输出存在，extension.js 正确导入所有模块
    Failure Indicators: 编译报错或缺少输出文件
    Evidence: .sisyphus/evidence/task-5-full-compile.txt

  Scenario: package.json 配置验证
    Tool: Bash (node -e)
    Preconditions: package.json 已更新
    Steps:
      1. 用 node 读取 package.json，检查 activationEvents 包含 `onLanguage:shellscript` 和 `onLanguage:bat`
      2. 检查 keywords 包含 `bat`, `batch`, `cmd`, `windows`
      3. 检查 description 包含 `batch` 相关文字
    Expected Result: 所有配置项正确
    Failure Indicators: 缺少配置项或拼写错误
    Evidence: .sisyphus/evidence/task-5-package-json.txt

  Scenario: VSIX 打包验证
    Tool: Bash
    Preconditions: 编译通过，@vscode/vsce 可用（如未安装则先运行 `npm install -g @vscode/vsce`）
    Steps:
      1. 运行 `npx @vscode/vsce package` 生成 .vsix 文件
      2. 检查当前目录下是否存在新生成的 `goto-files-*.vsix` 文件
      3. 检查生成的 .vsix 文件大小 > 0
    Expected Result: .vsix 文件成功生成且大小 > 0
    Failure Indicators: 打包失败或文件为空
    Evidence: .sisyphus/evidence/task-5-vsix-package.txt
  ```

  **Commit**: YES (Commit #2 — 与 Task 3 一起提交)
  - Message: `feat: add Windows batch file path navigation support`
  - Files: `src/extension.ts`, `package.json`
  - Pre-commit: `npm run compile`

- [ ] 6. 更新 README.md 和 README_ZH.md 文档

  **What to do**:
  - 更新 `README.md`：
    - 标题 description 更新为涵盖 shell + batch
    - Features 部分添加 BAT 支持的路径类型：
      - Windows absolute paths: `C:\Users\test\file.txt`
      - Relative paths: `.\script.bat`, `..\config.ini`
      - Prefix-less relative paths: `subdir\file.txt`
      - Environment variable paths: `%USERPROFILE%\file.txt`
    - 说明支持的文件类型：Shell scripts (`.sh`) and Batch files (`.bat`, `.cmd`)
  - 更新 `README_ZH.md`：
    - 与 README.md 对应的中文更新
    - 功能部分添加 BAT 支持的路径类型（中文描述）
    - 说明支持文件类型：Shell 脚本 (`.sh`) 和批处理文件 (`.bat`, `.cmd`)

  **Must NOT do**:
  - 不创建 CHANGELOG.md
  - 不修改 LICENSE 文件
  - 不更新 Demo GIF（现有 GIF 仅展示 shell，可以后续再更新）

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: 纯文档更新，需要保持中英文风格一致
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (should follow Task 5 to ensure feature description is final)
  - **Parallel Group**: Wave 3 (after Task 5)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `README.md` — 现有英文文档结构和风格
  - `README_ZH.md` — 现有中文文档结构和风格

  **WHY Each Reference Matters**:
  - 两个 README 必须保持结构一致，新增内容风格匹配现有内容

  **Acceptance Criteria**:
  - [ ] `README.md` 提及 BAT/CMD 文件支持
  - [ ] `README.md` 列出 Windows 路径类型
  - [ ] `README_ZH.md` 有对应的中文更新
  - [ ] 两个文件结构保持一致

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: README 完整性检查
    Tool: Bash (grep)
    Preconditions: 文档已更新
    Steps:
      1. 在 README.md 中搜索 `bat` 或 `batch` — 应存在
      2. 在 README.md 中搜索 `C:\` 或 `C:\\` — 应存在（Windows 路径示例）
      3. 在 README.md 中搜索 `%USERPROFILE%` — 应存在（环境变量示例）
      4. 在 README_ZH.md 中搜索 `bat` 或 `批处理` — 应存在
      5. 在 README_ZH.md 中搜索 `%USERPROFILE%` — 应存在
    Expected Result: 两个文档均包含 BAT 支持的文档内容
    Failure Indicators: 缺少 BAT 相关描述或路径示例
    Evidence: .sisyphus/evidence/task-6-readme-check.txt

  Scenario: 现有内容未被破坏
    Tool: Bash (grep)
    Preconditions: 文档已更新
    Steps:
      1. 在 README.md 中搜索 `/etc/hosts` — 应存在（原 Linux 路径示例）
      2. 在 README.md 中搜索 `~/scripts` — 应存在（原家目录示例）
      3. 在 README_ZH.md 中搜索 `/etc/hosts` — 应存在
    Expected Result: 原有 Linux 相关文档内容保留
    Failure Indicators: 原有内容被删除或替换
    Evidence: .sisyphus/evidence/task-6-readme-no-regression.txt
  ```

  **Commit**: YES (Commit #4)
  - Message: `docs: update README and README_ZH with batch file support`
  - Files: `README.md`, `README_ZH.md`
  - Pre-commit: —

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE.
> Agent 自动执行所有验证并汇总结果。验证完成后，将结果呈现给用户进行最终确认。
> 用户确认是流程管理步骤（确认交付物符合预期），不是 QA 验证步骤。

- [ ] F1. **Plan Compliance Audit** — `oracle`

  ```
  Scenario: Must Have 验证
    Tool: Bash (grep) + Bash (node -e)
    Preconditions: 所有实现任务已完成，npm run compile 成功
    Steps:
      1. 使用 Grep 搜索 src/batchProvider.ts 中是否包含盘符路径正则（`[A-Za-z]:`）— 验证 Must Have: 盘符绝对路径
      2. 使用 Grep 搜索 src/batchProvider.ts 中是否包含 `\.\.?[/\\\\]` 或类似相对路径匹配 — 验证 Must Have: 相对路径
      3. 使用 Grep 搜索 src/batchProvider.ts 中是否包含 `%` 和 `process.env` — 验证 Must Have: 环境变量展开
      4. 运行 `node -e "const sp = require('./out/shellProvider'); const re = sp.activateShell; console.log(typeof re)"` — 验证 Must Have: Shell 功能存在
      5. 确认 src/utils.ts、src/shellProvider.ts、src/batchProvider.ts、src/extension.ts 四个文件都存在 — 验证 Must Have: 模块化结构
    Expected Result: 5 项 Must Have 全部通过
    Failure Indicators: 任何 Must Have 缺失
    Evidence: .sisyphus/evidence/final-qa/f1-must-have.txt

  Scenario: Must NOT Have 验证
    Tool: Bash (grep)
    Preconditions: 所有实现任务已完成
    Steps:
      1. 使用 Grep 搜索 src/shellProvider.ts 中的 PATH_RE 值，确认未被修改（应为 `/(?:~\/|\/|\.\.?\/|[\w.-]+\/)[^\s'"]+/g`）
      2. 使用 Grep 搜索全项目 `*.ts` 文件中是否包含 `powershell` 或 `ps1`（不区分大小写）— 不应存在
      3. 使用 Grep 搜索全项目 `*.ts` 文件中是否包含 `\\\\\\\\` 双反斜杠 UNC 路径模式 — 不应存在（排除正则转义）
      4. 使用 Read 读取 package.json，确认 version 仍为 `0.0.1`
      5. 使用 Grep 搜索 src/batchProvider.ts 中是否包含 `%~` 处理逻辑（应被排除，不应有 expand 逻辑）
      6. 使用 Grep 搜索全项目是否存在 `webpack` 或 `esbuild` 配置文件
    Expected Result: 所有 Must NOT Have 验证通过（搜索结果为空或符合预期）
    Failure Indicators: 发现被禁止的模式
    Evidence: .sisyphus/evidence/final-qa/f1-must-not-have.txt

  Scenario: Evidence 文件存在性检查
    Tool: Bash (ls)
    Preconditions: 所有任务 QA 已执行
    Steps:
      1. 列出 .sisyphus/evidence/ 目录下所有文件
      2. 确认每个任务至少有一个 evidence 文件
    Expected Result: evidence 目录包含 task-1 到 task-6 的 evidence 文件
    Failure Indicators: 缺少任何任务的 evidence
    Evidence: .sisyphus/evidence/final-qa/f1-evidence-check.txt
  ```

  Output: `Must Have [5/5] | Must NOT Have [N/N] | Evidence [N files] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`

  ```
  Scenario: 编译与构建验证
    Tool: Bash
    Preconditions: 所有源码修改已完成
    Steps:
      1. 运行 `npm run compile` 并捕获输出
      2. 验证退出码为 0，无 error 输出
      3. 确认 out/ 目录包含 extension.js、utils.js、shellProvider.js、batchProvider.js
    Expected Result: 编译零错误，所有输出文件存在
    Failure Indicators: 编译报错或缺少输出文件
    Evidence: .sisyphus/evidence/final-qa/f2-compile.txt

  Scenario: 代码质量扫描
    Tool: Bash (grep)
    Preconditions: 所有源码修改已完成
    Steps:
      1. 使用 Grep 搜索 src/*.ts 中的 `console.log`（不含注释中的）— 不应存在于生产代码
      2. 使用 Grep 搜索 src/*.ts 中的 `@ts-ignore` — 不应存在
      3. 使用 Grep 搜索 src/*.ts 中的 `as any`，统计数量 — 允许存在（现有模式），但新增不应超过现有数量（2处：_matchedPath 和 _documentUri）
      4. 使用 Grep 搜索 src/*.ts 中的空 catch 块 `catch {}` 或 `catch {\\n}` — 不应有新增（现有 utils.ts 中的 fileExists 有一个合理的空 catch）
      5. 使用 Read 读取 src/batchProvider.ts，检查是否有未使用的 import
    Expected Result: 无 console.log、无 @ts-ignore、as any 数量合理、无新增空 catch
    Failure Indicators: 发现质量问题
    Evidence: .sisyphus/evidence/final-qa/f2-quality-scan.txt

  Scenario: AI slop 检查
    Tool: Bash (grep) + Read
    Preconditions: 所有源码修改已完成
    Steps:
      1. 使用 Read 读取 src/batchProvider.ts，检查注释是否过度（注释行数不应超过代码行数的 30%）
      2. 使用 Grep 搜索 src/batchProvider.ts 中是否包含 `TODO`、`FIXME`、`HACK` — 记录但不阻塞
      3. 使用 Grep 搜索 src/*.ts 中变量名为 `data`、`result`、`item`、`temp` 的定义 — 标记为潜在问题
    Expected Result: 代码简洁，无过度注释，变量名有意义
    Failure Indicators: 过度注释或泛化变量名
    Evidence: .sisyphus/evidence/final-qa/f2-slop-check.txt
  ```

  Output: `Build [PASS/FAIL] | Quality [N clean/N issues] | Slop [CLEAN/N flags] | VERDICT`

- [ ] F3. **Real Functional QA** — `unspecified-high`
  Full end-to-end functional verification via compilation, module loading, and source-level analysis.

  ```
  Scenario: Shell Provider 回归 — 模块加载与正则完整性
    Tool: Bash (node -e)
    Preconditions: `npm run compile` 成功
    Steps:
      1. 运行 `node -e "const sp = require('./out/shellProvider'); console.log(typeof sp.activateShell)"`
      2. 验证输出为 `function`
      3. 使用 Grep 工具搜索 `src/shellProvider.ts` 中的 PATH_RE 定义
      4. 验证正则为 `/(?:~\/|\/|\.\.?\/|[\w.-]+\/)[^\s'"]+/g`（与原始 extension.ts:7 完全一致）
    Expected Result: activateShell 导出为 function，PATH_RE 与原始正则完全一致
    Failure Indicators: activateShell 未导出或 PATH_RE 被修改
    Evidence: .sisyphus/evidence/final-qa/shell-regression.txt

  Scenario: BAT Provider 功能验证 — 正则匹配全覆盖
    Tool: Bash (node -e)
    Preconditions: `npm run compile` 成功
    Steps:
      1. 运行 `node -e "const bp = require('./out/batchProvider'); const re = bp.BAT_PATH_RE; re.lastIndex=0; const tests = { abs_bs: 'C:\\\\Users\\\\test\\\\file.txt', abs_fs: 'D:/folder/file.txt', dot_bs: '.\\\\script.bat', dotdot_bs: '..\\\\config.ini', dot_fs: './script.bat', prefix_bs: 'subdir\\\\file.txt', prefix_fs: 'subdir/file.txt', env: '%USERPROFILE%\\\\Documents\\\\file.txt' }; const results = {}; for (const [k,v] of Object.entries(tests)) { re.lastIndex=0; results[k] = re.test(v); } console.log(JSON.stringify(results))"`
      2. 验证所有结果均为 true
    Expected Result: 8 种合法路径全部匹配成功
    Failure Indicators: 任何一种路径返回 false
    Evidence: .sisyphus/evidence/final-qa/bat-positive-tests.txt

  Scenario: BAT Provider 负面验证 — 不应匹配的模式
    Tool: Bash (node -e)
    Preconditions: `npm run compile` 成功
    Steps:
      1. 运行 `node -e "const bp = require('./out/batchProvider'); const re = bp.BAT_PATH_RE; const negatives = { switch_Y: '/Y', switch_q: '/?', param1: '%1', param9: '%9', double_pct: '%%i', tilde_dp0: '%~dp0', tilde_f1: '%~f1', bare_file: 'file.txt', label: ':end' }; const results = {}; for (const [k,v] of Object.entries(negatives)) { re.lastIndex=0; results[k] = re.test(v); } console.log(JSON.stringify(results))"`
      2. 验证所有结果均为 false
    Expected Result: 9 种非路径模式全部不匹配
    Failure Indicators: 任何一种非路径模式返回 true
    Evidence: .sisyphus/evidence/final-qa/bat-negative-tests.txt

  Scenario: 环境变量展开功能端到端验证
    Tool: Bash (node -e)
    Preconditions: `npm run compile` 成功
    Steps:
      1. 运行 `node -e "const bp = require('./out/batchProvider'); const r1 = bp.expandEnvironmentVariables('%USERPROFILE%\\\\test'); const r2 = bp.expandEnvironmentVariables('%NONEXIST_XYZ%\\\\test'); console.log(JSON.stringify({ known: r1 === (process.env.USERPROFILE + '\\\\test'), unknown_preserved: r2 === '%NONEXIST_XYZ%\\\\test' }))"`
      2. 验证输出为 `{"known":true,"unknown_preserved":true}`
    Expected Result: 已知变量正确展开，未知变量保持原样
    Failure Indicators: 任一结果为 false
    Evidence: .sisyphus/evidence/final-qa/env-expand-e2e.txt

  Scenario: 跨模块集成 — extension 入口正确加载所有 provider
    Tool: Bash (node -e + grep)
    Preconditions: `npm run compile` 成功
    Steps:
      1. 使用 Grep 搜索 `out/extension.js` 中是否包含 `shellProvider`
      2. 使用 Grep 搜索 `out/extension.js` 中是否包含 `batchProvider`
      3. 使用 Grep 搜索 `out/shellProvider.js` 或 `out/batchProvider.js` 中是否包含 `utils`（utils 由 provider 间接引用，extension.ts 不直接导入 utils）
      4. 运行 `node -e "const ext = require('./out/extension'); console.log(JSON.stringify({ activate: typeof ext.activate, deactivate: typeof ext.deactivate }))"`
      5. 验证输出为 `{"activate":"function","deactivate":"function"}`
    Expected Result: extension.js 导入了 shellProvider 和 batchProvider 两个模块，provider 模块间接引用 utils，且导出了 activate/deactivate 函数
    Failure Indicators: extension.js 缺少 provider 导入，或 provider 缺少 utils 引用，或 activate/deactivate 未导出
    Evidence: .sisyphus/evidence/final-qa/integration-check.txt

  Scenario: test.bat 内容覆盖验证
    Tool: Bash (grep)
    Preconditions: test/test.bat 已创建
    Steps:
      1. 使用 Grep 搜索 test/test.bat 中是否包含 `test0.py`（相对路径测试）
      2. 使用 Grep 搜索 test/test.bat 中是否包含 `test_1`（无前缀相对路径测试）
      3. 使用 Grep 搜索 test/test.bat 中是否包含 `%USERPROFILE%`（环境变量测试）
      4. 使用 Grep 搜索 test/test.bat 中是否包含 `/Y` 或 `%~dp0` 或 `%%`（负面测试用例）
    Expected Result: 测试文件包含所有正面和负面测试用例
    Failure Indicators: 缺少任何类型的测试用例
    Evidence: .sisyphus/evidence/final-qa/test-bat-coverage.txt
  ```

  Output: `Shell Regression [PASS/FAIL] | BAT Positive [8/8] | BAT Negative [9/9] | Env Expand [PASS/FAIL] | Integration [PASS/FAIL] | test.bat Coverage [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`

  ```
  Scenario: 任务交付物 1:1 对照验证
    Tool: Bash (git diff) + Read
    Preconditions: 所有实现任务已提交
    Steps:
      1. 运行 `git log --oneline` 获取本次所有提交
      2. 对每个提交运行 `git show --stat <commit-hash>` 获取变更文件列表
      3. 对照计划的 Commit Strategy 表格，验证每个提交包含且仅包含计划中列出的文件
      4. 使用 Read 读取 src/utils.ts，确认只包含 fileExists（不超出 Task 1 范围）
      5. 使用 Read 读取 src/shellProvider.ts，确认包含 PATH_RE + expandHome + resolvePath + activateShell（Task 2 范围）
      6. 使用 Read 读取 src/batchProvider.ts，确认包含 BAT_PATH_RE + expandEnvironmentVariables + resolvePath + activateBatch（Task 3 范围）
    Expected Result: 每个文件的内容与计划任务范围一致
    Failure Indicators: 文件包含超出计划范围的代码，或缺少计划要求的功能
    Evidence: .sisyphus/evidence/final-qa/f4-task-fidelity.txt

  Scenario: Must NOT Do 合规检查
    Tool: Bash (grep)
    Preconditions: 所有实现任务已完成
    Steps:
      1. 使用 Grep 搜索 src/shellProvider.ts 中 PATH_RE 的值，与原始 extension.ts 中的 `/(?:~\/|\/|\.\.?\/|[\w.-]+\/)[^\s'"]+/g` 对比 — 必须完全一致
      2. 使用 Grep 搜索全项目 `*.ts` 中是否包含 `ps1` 或 `powershell` — 不应存在
      3. 使用 Grep 搜索全项目 `*.ts` 中是否包含 UNC 路径匹配模式（`\\\\\\\\`）— 不应存在
      4. 使用 Grep 搜索是否存在 `jest.config`、`vitest.config`、`.mocharc` 等测试框架配置 — 不应存在
      5. 使用 Grep 搜索是否存在 `webpack.config`、`esbuild` 等构建配置 — 不应存在
      6. 使用 Read 读取 package.json，确认 version 仍为 `0.0.1`
    Expected Result: 所有禁止项均未出现
    Failure Indicators: 发现任何禁止项
    Evidence: .sisyphus/evidence/final-qa/f4-must-not-do.txt

  Scenario: 跨任务污染检查
    Tool: Bash (git diff)
    Preconditions: 所有实现任务已提交
    Steps:
      1. 对 Commit #1（refactor）运行 `git show --stat`，确认只修改 src/utils.ts、src/shellProvider.ts、src/extension.ts
      2. 对 Commit #2（feat）运行 `git show --stat`，确认只修改 src/batchProvider.ts、src/extension.ts、package.json
      3. 对 Commit #3（test）运行 `git show --stat`，确认只添加 test/test.bat
      4. 对 Commit #4（docs）运行 `git show --stat`，确认只修改 README.md、README_ZH.md
      5. 确认没有提交包含 test/test.sh、test/test0.py、test/test_1/ 的修改
    Expected Result: 每个提交只涉及计划中指定的文件，无跨任务文件修改
    Failure Indicators: 提交包含非计划文件，或现有测试文件被修改
    Evidence: .sisyphus/evidence/final-qa/f4-contamination.txt
  ```

  Output: `Tasks [N/N compliant] | Must NOT Do [N/N] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

| Commit # | Message | Files | Pre-commit Check |
|----------|---------|-------|-----------------|
| 1 | `refactor: extract shared utils and shell provider into separate modules` | `src/utils.ts`, `src/shellProvider.ts`, `src/extension.ts` | `npm run compile` |
| 2 | `feat: add Windows batch file path navigation support` | `src/batchProvider.ts`, `src/extension.ts`, `package.json` | `npm run compile` |
| 3 | `test: add test.bat with sample Windows paths for manual verification` | `test/test.bat` | `npm run compile` |
| 4 | `docs: update README and README_ZH with batch file support` | `README.md`, `README_ZH.md` | — |

---

## Success Criteria

### Verification Commands
```bash
npm run compile          # Expected: zero errors
npx vsce package         # Expected: .vsix generated successfully
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] `npm run compile` passes
- [ ] Shell 脚本路径跳转回归测试通过
- [ ] BAT 文件路径跳转功能正常
- [ ] `npx vsce package` 成功
