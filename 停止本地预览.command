#!/bin/zsh

set -e

PID_FILE="${TMPDIR:-/tmp}/youdao_competitor_preview.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "当前没有检测到正在运行的本地预览。"
  read -r "?按回车关闭窗口..."
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"

if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "本地预览已停止。"
else
  echo "没有检测到可停止的本地预览进程。"
fi

rm -f "$PID_FILE"
echo ""
read -r "?按回车关闭窗口..."
