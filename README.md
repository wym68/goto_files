# Goto Files

[中文文档](./README_ZH.md)

VSCode extension for opening file paths directly from Shell scripts and Batch files with Ctrl+Click or F12.

## Demo

![Demo](./doc/Demo_video.gif)

## Features

- **Ctrl+Left Click**: Click on a file path to open the corresponding file directly
- **F12 Go to Definition**: Place cursor on a path and press F12 to jump
- Supported file types: Shell scripts (`.sh`) and Batch files (`.bat`, `.cmd`)
- Supported path types:
  - Absolute paths: `/etc/hosts`
  - Windows absolute paths: `C:\Users\test\file.txt`
  - Home directory paths: `~/scripts/my.sh`
  - Relative paths: `./script.sh`, `../config.conf`
  - Prefix-less relative paths: `test_1/test1.py`
  - Windows relative paths: `.\script.bat`, `..\config.ini`
  - Windows prefix-less relative paths: `subdir\file.txt`
  - Environment variable paths: `%USERPROFILE%\file.txt`

Quoted BAT paths are supported, for example `copy "C:\My Documents\file.txt" backup.txt`.
Unquoted Windows paths with spaces such as `C:\Program Files\app.exe` are not supported.

## Notes

- Links are resolved lazily, so non-existent paths will not open.
- Relative paths are resolved against the current document first, then the workspace root.
- UNC paths such as `\\server\share` are intentionally not supported in this version.

## Installation

Search for `goto files` in the VSCode Extensions panel and install it.

## License

MIT
