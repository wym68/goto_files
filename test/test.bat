@echo off
@REM Filename: test.bat
@REM File Created: Thursday, 9th April 2026
@REM Description: Manual path navigation test file for Windows BAT

@REM ---- Relative paths (from this file's directory) ----

@REM Backslash relative path:
type .\test0.py

@REM Forward-slash relative path:
type ./test0.py

@REM Prefix-less relative path with backslash:
type test_1\test1.py

@REM Prefix-less relative path with forward slash:
type test_1/test1.py

@REM Multi-level backslash relative path:
type .\test_1\test_2\test2.py

@REM Multi-level forward-slash relative path:
type ./test_1/test_2/test2.py

@REM Environment variable path (may or may not exist):
echo %USERPROFILE%\Desktop

@REM Quoted path (path match should exclude the quotes):
echo "%USERPROFILE%\Desktop"

@REM ---- Should NOT jump (these are not file paths) ----
@REM xcopy /Y
@REM echo %1
@REM goto :end
@REM for %%i in (*.bat) do echo %%i
@REM cd %~dp0
