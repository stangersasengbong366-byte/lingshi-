#!/bin/zsh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="${TMPDIR:-/tmp}/youdao_competitor_preview.pid"
LOG_FILE="${TMPDIR:-/tmp}/youdao_competitor_preview.log"
PORT="${PORT:-3001}"
HOST="${HOST:-127.0.0.1}"
URL="http://${HOST}:${PORT}/preview.html?grade=%E6%96%B0%E9%AB%98%E4%B8%80&v=$(date +%s)"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js。"
  echo "请先安装 Node.js，再重新双击这个文件。"
  read -r "?按回车关闭窗口..."
  exit 1
fi

is_running() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

if is_running; then
  echo "本地预览已在运行。"
else
  nohup node server.js > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 2

  if ! is_running; then
    echo "本地预览启动失败。"
    echo ""
    if [[ -f "$LOG_FILE" ]]; then
      cat "$LOG_FILE"
    fi
    echo ""
    read -r "?按回车关闭窗口..."
    exit 1
  fi

  echo "本地预览已启动。"
fi

open "$URL"
echo ""
echo "已为你打开本地预览："
echo "$URL"
echo ""
echo "这个窗口可以直接关掉。"
echo "如果之后想停止预览，双击“停止本地预览.command”即可。"
echo ""
read -r "?按回车关闭窗口..."
