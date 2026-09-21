@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 serve.py
    goto :done
)
where python >nul 2>nul
if not errorlevel 1 (
    python serve.py
    goto :done
)
echo 未找到 Python 3。电脑可直接用浏览器打开 index.html。
echo 手机局域网启动器需要先安装 Python 3。
:done
pause
