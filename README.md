# Goto Files

VSCode 扩展：在 Shell 脚本中实现 Ctrl+左键点击文件路径跳转。

## 功能

- **Ctrl+左键点击**：点击文件路径直接打开对应文件
- **F12 转到定义**：光标放在路径上按 F12 跳转
- 支持路径类型：
  - 绝对路径：`/etc/hosts`
  - 家目录路径：`~/scripts/my.sh`
  - 相对路径：`./script.sh`、`../config.conf`
  - 无前缀相对路径：`test_1/test1.py`

## 安装

1. 克隆项目到本地
2. 执行 `npm install`
3. 按 F5 启动扩展开发主机测试

## 发布到 VSCode 市场

```bash
npm install -g vsce
vsce package
vsce publish
```

## 许可证

MIT
