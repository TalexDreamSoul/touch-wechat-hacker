#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appPath = path.resolve(
  __dirname,
  '../src-tauri/target/release/bundle/macos/WeChat Multi Manager.app'
);

if (!fs.existsSync(appPath)) {
  console.log(`Tauri app bundle not found, skipping codesign: ${appPath}`);
  process.exit(0);
}

const result = spawnSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
  stdio: 'inherit'
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log(`Signed Tauri app bundle: ${appPath}`);
