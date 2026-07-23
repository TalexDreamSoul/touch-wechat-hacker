#!/bin/zsh
cd "$(dirname "$0")"
open "http://127.0.0.1:5173"
exec node server.js
