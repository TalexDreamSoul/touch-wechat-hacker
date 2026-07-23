#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const kids = [];

function run(cmd, args, name) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });
  child.on('exit', (code, signal) => {
    console.log(`[${name}] exited`, code, signal || '');
    for (const k of kids) {
      if (k !== child && !k.killed) k.kill('SIGTERM');
    }
    process.exit(code || 0);
  });
  kids.push(child);
}

run(process.execPath, ['server.js'], 'api');
run(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev', '-H', '127.0.0.1', '-p', '5173'], 'web');

function shutdown() {
  for (const k of kids) {
    if (!k.killed) k.kill('SIGTERM');
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
