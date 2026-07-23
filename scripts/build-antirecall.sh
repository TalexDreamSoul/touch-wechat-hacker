#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$ROOT_DIR/packages/antirecall"

cd "$PKG_DIR"
swift build -c release

BIN="$PKG_DIR/.build/release/wechat-antirecall"
if [[ ! -x "$BIN" ]]; then
  # SwiftPM may place binaries under triple-specific paths.
  BIN="$(find "$PKG_DIR/.build" -type f -name wechat-antirecall -perm -111 | head -n 1 || true)"
fi

if [[ -z "${BIN:-}" || ! -x "$BIN" ]]; then
  echo "error: release binary not found under packages/antirecall/.build" >&2
  exit 1
fi

echo "built: $BIN"
