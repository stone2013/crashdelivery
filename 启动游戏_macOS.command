#!/bin/sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 serve.py
else
  printf '\n未找到 Python 3。电脑可直接用浏览器打开 index.html。\n手机局域网启动器需要 Python 3。\n'
fi
printf '\n按回车关闭此窗口。'
read -r _
