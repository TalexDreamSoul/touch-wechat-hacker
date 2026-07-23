#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const source = process.execPath;
const target = path.resolve(__dirname, '../src-tauri/bin/node');

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
fs.chmodSync(target, 0o755);

console.log(`Prepared bundled Node runtime: ${target}`);
