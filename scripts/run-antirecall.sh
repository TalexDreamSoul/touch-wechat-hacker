#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$ROOT_DIR/packages/antirecall"
DEFAULT_CONFIG="$PKG_DIR/patches-268601-multi-experimental-v2.json"
DEFAULT_APP="/Applications/WeChat.app"

BIN="$PKG_DIR/.build/release/wechat-antirecall"
if [[ ! -x "$BIN" ]]; then
  BIN="$(find "$PKG_DIR/.build" -type f -name wechat-antirecall -perm -111 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "${BIN:-}" || ! -x "$BIN" ]]; then
  echo "error: wechat-antirecall binary missing. Run: npm run antirecall:build" >&2
  exit 1
fi

# Inject defaults only when caller did not pass them.
args=("$@")
has_app=0
has_config=0
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    --app) has_app=1 ;;
    --config) has_config=1 ;;
  esac
done

extra=()
if [[ $has_app -eq 0 ]]; then
  extra+=(--app "$DEFAULT_APP")
fi
if [[ $has_config -eq 0 && -f "$DEFAULT_CONFIG" ]]; then
  extra+=(--config "$DEFAULT_CONFIG")
fi

exec "$BIN" "${args[@]}" "${extra[@]}"
