#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 17329);
const APP_ROOT = __dirname;
const REPO_ROOT = path.resolve(APP_ROOT, '../..');
const ANTIRECALL_PKG = path.join(REPO_ROOT, 'packages/antirecall');
const PUBLIC_DIR = path.join(APP_ROOT, 'public');
const CONFIG_DIR = path.join(os.homedir(), '.touch-wechat-hacker');
const LEGACY_CONFIG_DIR = path.join(os.homedir(), '.wechat-multi-manager');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const LEGACY_CONFIG_PATH = path.join(LEGACY_CONFIG_DIR, 'config.json');

function resolveAntirecallTool(preferred) {
  const candidates = [
    preferred,
    path.join(ANTIRECALL_PKG, '.build/release/wechat-antirecall'),
    path.join(ANTIRECALL_PKG, '.build/arm64-apple-macosx/release/wechat-antirecall'),
    path.join(ANTIRECALL_PKG, '.build/debug/wechat-antirecall'),
    path.join(ANTIRECALL_PKG, '.build/arm64-apple-macosx/debug/wechat-antirecall')
  ].filter(Boolean);
  for (const candidate of candidates) {
    const full = expandHome(candidate);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch {}
  }
  return expandHome(candidates[1] || candidates[0]);
}

function listPatchConfigs() {
  try {
    return fs
      .readdirSync(ANTIRECALL_PKG)
      .filter((name) => name.endsWith('.json') && (name.startsWith('patches') || name.includes('patch')))
      .sort((a, b) => {
        if (a === 'patches.json') return -1;
        if (b === 'patches.json') return 1;
        return b.localeCompare(a);
      })
      .map((name) => ({
        name,
        path: path.join(ANTIRECALL_PKG, name),
        recommended: name === 'patches-268601-multi-experimental-v2.json' || name === 'patches.json'
      }));
  } catch {
    return [];
  }
}

function isLegacyAntirecallPath(p) {
  const full = path.resolve(expandHome(p || ''));
  if (!full) return false;
  if (full.startsWith(path.resolve(ANTIRECALL_PKG) + path.sep) || full === path.resolve(ANTIRECALL_PKG)) return false;
  return (
    /[/\\]wechat-antirecall(?:-archived-[^/\\]+)?[/\\]/.test(full) ||
    /[/\\]Outdated[/\\].*wechat-antirecall/.test(full) ||
    full.includes(`${path.sep}Projects${path.sep}wechat-antirecall`)
  );
}

function pathMissing(p) {
  if (!p) return true;
  try {
    fs.accessSync(expandHome(p), fs.constants.F_OK);
    return false;
  } catch {
    return true;
  }
}

const DEFAULTS = {
  wechatApp: '/Applications/WeChat.app',
  instanceRoot: path.join(os.homedir(), 'Library/Application Support/WeChatMulti/Instances'),
  launcherRoot: path.join(os.homedir(), 'Applications/WeChat Multi'),
  tmpRoot: path.join(os.homedir(), 'Library/Caches/WeChatMulti/tmp'),
  antirecallTool: resolveAntirecallTool(),
  antirecallConfig: path.join(ANTIRECALL_PKG, 'patches-268601-multi-experimental-v2.json'),
  tweakTool: '',
  defaultTweakDylib: '',
  defaultExtraEnv: '',
  auth: null,
  instances: []
};

const ICON_PRESETS = {
  green: { name: '绿色', color: '16A34A' },
  blue: { name: '蓝色', color: '2563EB' },
  purple: { name: '紫色', color: '7C3AED' },
  orange: { name: '橙色', color: 'EA580C' },
  pink: { name: '粉色', color: 'DB2777' },
  slate: { name: '深灰', color: '334155' }
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function expandHome(p) {
  if (!p || typeof p !== 'string') return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function slugify(input) {
  const base = String(input || 'wechat')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `wechat-${Date.now()}`;
}

function publicConfig(config) {
  const { auth, __meta, ...rest } = config;
  return rest;
}

function runtimeMeta(config) {
  const meta = config.__meta || {};
  return {
    repoRoot: REPO_ROOT,
    antirecallPackage: ANTIRECALL_PKG,
    configPath: CONFIG_PATH,
    legacyConfigPath: LEGACY_CONFIG_PATH,
    defaults: {
      wechatApp: DEFAULTS.wechatApp,
      instanceRoot: DEFAULTS.instanceRoot,
      launcherRoot: DEFAULTS.launcherRoot,
      tmpRoot: DEFAULTS.tmpRoot,
      antirecallTool: resolveAntirecallTool(DEFAULTS.antirecallTool),
      antirecallConfig: DEFAULTS.antirecallConfig
    },
    patchConfigs: listPatchConfigs(),
    migrations: meta.migrations || [],
    migratedFromLegacy: Boolean(meta.migratedFromLegacy)
  };
}

function hashToken(token, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(token), salt, 64).toString('hex');
  return { salt, hash };
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyToken(config, token) {
  if (!config.auth || !config.auth.tokenHash || !config.auth.tokenSalt) return false;
  const { hash } = hashToken(token || '', config.auth.tokenSalt);
  return timingSafeEqualHex(hash, config.auth.tokenHash);
}

function tokenFromRequest(req) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : '';
}

function authStatus(config) {
  return { configured: Boolean(config.auth && config.auth.tokenHash && config.auth.tokenSalt) };
}

async function requireAuth(req, res, config) {
  if (!authStatus(config).configured) {
    sendJson(res, 428, { error: 'token not configured', auth: authStatus(config) });
    return true;
  }
  const token = tokenFromRequest(req);
  if (verifyToken(config, token)) return false;
  sendJson(res, 401, { error: 'unauthorized', auth: authStatus(config) });
  return true;
}

function parseEnvLines(text) {
  const env = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) env[key] = expandHome(value);
  }
  return env;
}

function instanceEnv(config, instance) {
  const home = expandHome(instance.homeDir || path.join(config.instanceRoot, instance.id));
  const tmp = expandHome(instance.tmpDir || path.join(config.tmpRoot, instance.id));
  const env = {
    ...process.env,
    ...parseEnvLines(config.defaultExtraEnv),
    ...parseEnvLines(instance.extraEnv),
    HOME: home,
    CFFIXED_USER_HOME: home,
    TMPDIR: tmp.endsWith(path.sep) ? tmp : tmp + path.sep,
    WECHAT_MULTI_INSTANCE_ID: instance.id,
    WECHAT_MULTI_INSTANCE_NAME: instance.name || instance.id
  };
  const dylib = expandHome(instance.tweakDylib || config.defaultTweakDylib || '');
  if (instance.enableTweak && dylib) {
    // Experimental: this may be blocked by hardened runtime / SIP depending on target binary.
    env.DYLD_INSERT_LIBRARIES = dylib;
  }
  return env;
}

function wechatExecutable(config) {
  return path.join(expandHome(config.wechatApp), 'Contents/MacOS/WeChat');
}

function appIcon(config) {
  return path.join(expandHome(config.wechatApp), 'Contents/Resources/AppIcon.icns');
}

function launcherPath(config, instance) {
  return path.join(expandHome(config.launcherRoot), `${instance.name || instance.id}.app`);
}

function persistentHomeFor(config, instance) {
  return path.join(expandHome(config.instanceRoot), instance.id);
}

function persistentTmpFor(config, instance) {
  return path.join(expandHome(config.tmpRoot), instance.id);
}

function isTemporaryPath(p) {
  const resolved = path.resolve(expandHome(p || ''));
  const tmp = path.resolve(os.tmpdir());
  return resolved === tmp || resolved.startsWith(tmp + path.sep) || resolved.startsWith('/private' + tmp + path.sep);
}

async function readConfigFile(filePath) {
  const raw = await fsp.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function normalizeConfig(parsed = {}) {
  const merged = { ...DEFAULTS, ...parsed };
  merged.instances = Array.isArray(merged.instances) ? merged.instances : [];
  merged.wechatApp = expandHome(merged.wechatApp || DEFAULTS.wechatApp);
  merged.instanceRoot = expandHome(merged.instanceRoot || DEFAULTS.instanceRoot);
  merged.launcherRoot = expandHome(merged.launcherRoot || DEFAULTS.launcherRoot);
  merged.tmpRoot = expandHome(merged.tmpRoot || DEFAULTS.tmpRoot);
  merged.antirecallTool = expandHome(merged.antirecallTool || DEFAULTS.antirecallTool);
  merged.antirecallConfig = expandHome(merged.antirecallConfig || DEFAULTS.antirecallConfig);
  merged.tweakTool = expandHome(merged.tweakTool || '');
  merged.defaultTweakDylib = expandHome(merged.defaultTweakDylib || '');
  merged.defaultExtraEnv = merged.defaultExtraEnv == null ? '' : String(merged.defaultExtraEnv);
  return merged;
}

function migrateConfig(config) {
  const next = { ...config };
  const migrations = [];

  const desiredTool = resolveAntirecallTool(DEFAULTS.antirecallTool);
  if (!next.antirecallTool || pathMissing(next.antirecallTool) || isLegacyAntirecallPath(next.antirecallTool)) {
    if (next.antirecallTool !== desiredTool) {
      migrations.push({
        field: 'antirecallTool',
        from: next.antirecallTool || null,
        to: desiredTool,
        reason: '旧路径失效或已归档，已切换到 monorepo 内 release 二进制'
      });
      next.antirecallTool = desiredTool;
    }
  } else {
    next.antirecallTool = resolveAntirecallTool(next.antirecallTool);
  }

  const desiredConfig = DEFAULTS.antirecallConfig;
  if (!next.antirecallConfig || pathMissing(next.antirecallConfig) || isLegacyAntirecallPath(next.antirecallConfig)) {
    if (next.antirecallConfig !== desiredConfig) {
      migrations.push({
        field: 'antirecallConfig',
        from: next.antirecallConfig || null,
        to: desiredConfig,
        reason: '旧 patches 路径失效或已归档，已切换到 monorepo 默认配置'
      });
      next.antirecallConfig = desiredConfig;
    }
  }

  // Prefer stable cache dir over ephemeral /var/folders temp roots.
  if (next.tmpRoot && isTemporaryPath(next.tmpRoot) && next.tmpRoot !== DEFAULTS.tmpRoot) {
    migrations.push({
      field: 'tmpRoot',
      from: next.tmpRoot,
      to: DEFAULTS.tmpRoot,
      reason: '临时目录落在系统 TMP 下不稳定，已切换到用户 Cache 目录'
    });
    next.tmpRoot = DEFAULTS.tmpRoot;
  }

  return { config: next, migrations };
}

async function ensureManagedDirs(config) {
  for (const dir of [config.instanceRoot, config.launcherRoot, config.tmpRoot, CONFIG_DIR]) {
    if (!dir) continue;
    await fsp.mkdir(expandHome(dir), { recursive: true }).catch(() => {});
  }
}

async function ensureConfig() {
  await fsp.mkdir(CONFIG_DIR, { recursive: true });

  let sourcePath = null;
  let parsed = null;
  try {
    parsed = await readConfigFile(CONFIG_PATH);
    sourcePath = CONFIG_PATH;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  if (!parsed) {
    try {
      parsed = await readConfigFile(LEGACY_CONFIG_PATH);
      sourcePath = LEGACY_CONFIG_PATH;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  if (!parsed) {
    const cfg = normalizeConfig({ ...DEFAULTS, instances: [] });
    await saveConfig(cfg);
    await ensureManagedDirs(cfg);
    cfg.__meta = { migrations: [], sourcePath: CONFIG_PATH, migratedFromLegacy: false };
    return cfg;
  }

  const normalized = normalizeConfig(parsed);
  const { config, migrations } = migrateConfig(normalized);
  const migratedFromLegacy = sourcePath === LEGACY_CONFIG_PATH;
  const shouldPersist = migratedFromLegacy || migrations.length > 0 || sourcePath !== CONFIG_PATH;

  if (shouldPersist) {
    await saveConfig(config);
    if (migratedFromLegacy) {
      migrations.unshift({
        field: 'configPath',
        from: LEGACY_CONFIG_PATH,
        to: CONFIG_PATH,
        reason: '配置已从 ~/.wechat-multi-manager 迁移到 ~/.touch-wechat-hacker'
      });
    }
  }

  await ensureManagedDirs(config);

  config.__meta = {
    migrations,
    sourcePath: CONFIG_PATH,
    migratedFromLegacy
  };
  return config;
}

async function saveConfig(config) {
  await fsp.mkdir(CONFIG_DIR, { recursive: true });
  const { __meta, ...persistable } = config;
  await fsp.writeFile(CONFIG_PATH, JSON.stringify(persistable, null, 2) + '\n', 'utf8');
}

function sendJson(res, code, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

async function readJsonBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2 * 1024 * 1024) throw new Error('request body too large');
  }
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function execFileP(cmd, args, options = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: options.timeout || 30000, maxBuffer: 10 * 1024 * 1024, env: options.env || process.env }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error && typeof error.code === 'number' ? error.code : 0,
        signal: error && error.signal ? error.signal : null,
        stdout: stdout || '',
        stderr: stderr || '',
        error: error ? error.message : null
      });
    });
  });
}

async function getProcesses() {
  const r = await execFileP('/bin/ps', ['-axo', 'pid=,ppid=,stat=,etime=,command='], { timeout: 10000 });
  const lines = r.stdout.split('\n').filter(Boolean);
  return lines.map(line => {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (!m) return null;
    return { pid: Number(m[1]), ppid: Number(m[2]), stat: m[3], etime: m[4], command: m[5] };
  }).filter(Boolean);
}

function isWeChatMainProcess(proc) {
  return /\/Contents\/MacOS\/WeChat(?:\s|$)/.test(proc.command || '');
}

async function processHasOpenPath(pid, needle) {
  if (!needle) return false;
  const r = await execFileP('/usr/sbin/lsof', ['-nP', '-p', String(pid)], { timeout: 5000 });
  return (r.stdout || '').includes(needle);
}

async function findMainForInstance(allWechatMains, childProcs, home) {
  // WeChatAppEx command line includes --wechat-files-path=<HOME>/Library/Containers/...
  const child = childProcs.find(p => (p.command || '').includes(home));
  if (child) {
    const parent = allWechatMains.find(p => p.pid === child.ppid);
    if (parent) return parent;
  }

  // The main WeChat process does not expose HOME in ps output, so fall back to lsof.
  for (const proc of allWechatMains) {
    if (await processHasOpenPath(proc.pid, home)) return proc;
  }
  return null;
}

async function enrichInstances(config) {
  const procs = await getProcesses();
  const exe = wechatExecutable(config);
  const allWechatMains = procs.filter(isWeChatMainProcess);
  const childProcs = procs.filter(p => (p.command || '').includes('WeChatAppEx'));

  const result = [];
  for (const inst of config.instances) {
    const home = expandHome(inst.homeDir || path.join(config.instanceRoot, inst.id));
    const tmp = expandHome(inst.tmpDir || path.join(config.tmpRoot, inst.id));
    const main = await findMainForInstance(allWechatMains, childProcs, home);
    const children = main ? childProcs.filter(p => p.ppid === main.pid || (p.command || '').includes(home)) : childProcs.filter(p => (p.command || '').includes(home));
    result.push({
      ...inst,
      homeDir: home,
      tmpDir: tmp,
      launcherPath: launcherPath(config, inst),
      running: Boolean(main),
      pid: main ? main.pid : null,
      etime: main ? main.etime : null,
      children: children.map(p => ({ pid: p.pid, ppid: p.ppid, stat: p.stat, etime: p.etime, command: p.command })),
      expectedExecutable: exe
    });
  }
  return result;
}

async function ensureInstanceDirs(config, instance) {
  const home = expandHome(instance.homeDir || path.join(config.instanceRoot, instance.id));
  const tmp = expandHome(instance.tmpDir || path.join(config.tmpRoot, instance.id));
  await fsp.mkdir(home, { recursive: true });
  await fsp.mkdir(tmp, { recursive: true });
  await fsp.mkdir(path.join(home, 'Library/Containers/com.tencent.xinWeChat/Data/Documents'), { recursive: true });
  await fsp.mkdir(path.join(home, 'Documents'), { recursive: true });
}

async function createInstance(config, body) {
  const name = String(body.name || '').trim() || `WeChat ${config.instances.length + 1}`;
  let id = slugify(body.id || name).toLowerCase();
  const used = new Set(config.instances.map(i => i.id));
  if (used.has(id)) {
    const suffix = crypto.randomBytes(3).toString('hex');
    id = `${id}-${suffix}`;
  }
  const instance = {
    id,
    name,
    homeDir: expandHome(body.homeDir || path.join(config.instanceRoot, id)),
    tmpDir: expandHome(body.tmpDir || path.join(config.tmpRoot, id)),
    notes: String(body.notes || ''),
    icon: body.icon ? expandHome(String(body.icon)) : '',
    iconPreset: body.iconPreset ? String(body.iconPreset) : '',
    iconLabel: body.iconLabel ? String(body.iconLabel) : '',
    enableTweak: Boolean(body.enableTweak),
    tweakDylib: body.tweakDylib ? expandHome(String(body.tweakDylib)) : '',
    extraEnv: body.extraEnv ? String(body.extraEnv) : '',
    createdAt: new Date().toISOString()
  };
  config.instances.push(instance);
  await ensureInstanceDirs(config, instance);
  await saveConfig(config);
  return instance;
}

async function updateInstance(config, id, body) {
  const inst = config.instances.find(i => i.id === id);
  if (!inst) throw Object.assign(new Error('instance not found'), { status: 404 });
  for (const key of ['name', 'notes', 'icon', 'iconPreset', 'iconLabel', 'tweakDylib', 'extraEnv']) {
    if (body[key] !== undefined) inst[key] = String(body[key]);
  }
  if (body.enableTweak !== undefined) inst.enableTweak = Boolean(body.enableTweak);
  if (body.homeDir !== undefined) inst.homeDir = expandHome(String(body.homeDir));
  if (body.tmpDir !== undefined) inst.tmpDir = expandHome(String(body.tmpDir));
  await ensureInstanceDirs(config, inst);
  await saveConfig(config);
  return inst;
}

async function launchInstance(config, instance) {
  await ensureInstanceDirs(config, instance);
  const exe = wechatExecutable(config);
  await fsp.access(exe, fs.constants.X_OK);
  const env = instanceEnv(config, instance);
  const child = spawn(exe, [], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env,
    cwd: path.dirname(exe)
  });
  child.unref();
  return { pid: child.pid, homeDir: env.HOME, tmpDir: env.TMPDIR };
}

async function stopInstance(config, instance) {
  const enriched = (await enrichInstances(config)).find(i => i.id === instance.id);
  if (!enriched || !enriched.running) return { stopped: false, message: 'not running' };
  const targets = [...enriched.children.map(c => c.pid), enriched.pid].filter(Boolean);
  for (const pid of targets) {
    try { process.kill(pid, 'SIGTERM'); } catch (_) {}
  }
  return { stopped: true, pids: targets };
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

async function ensureTemplateIcon(config, instance) {
  const presetKey = instance.iconPreset || '';
  if (!presetKey || !ICON_PRESETS[presetKey]) return '';
  const iconDir = path.join(CONFIG_DIR, 'icons');
  await fsp.mkdir(iconDir, { recursive: true });
  const label = instance.iconLabel || (instance.name || instance.id).slice(0, 2);
  const out = path.join(iconDir, `${instance.id}-${presetKey}-${slugify(label)}.icns`);
  try {
    await fsp.access(out);
    return out;
  } catch (_) {}
  const script = path.join(APP_ROOT, 'bin/make-icon.swift');
  const result = await execFileP(script, [out, ICON_PRESETS[presetKey].color, label], { timeout: 120000 });
  if (!result.ok) throw new Error(`生成图标失败：${result.stderr || result.stdout || result.error}`);
  return out;
}

async function createLauncher(config, instance) {
  await ensureInstanceDirs(config, instance);
  const appPath = launcherPath(config, instance);
  const contents = path.join(appPath, 'Contents');
  const macos = path.join(contents, 'MacOS');
  const resources = path.join(contents, 'Resources');
  await fsp.rm(appPath, { recursive: true, force: true });
  await fsp.mkdir(macos, { recursive: true });
  await fsp.mkdir(resources, { recursive: true });

  const generatedIcon = await ensureTemplateIcon(config, instance);
  const iconSource = expandHome(instance.icon || generatedIcon || appIcon(config));
  let iconName = 'AppIcon.icns';
  try {
    await fsp.copyFile(iconSource, path.join(resources, iconName));
  } catch (_) {
    iconName = '';
  }

  const executableName = 'launch-wechat-instance';
  const script = `#!/bin/zsh
set -euo pipefail
export HOME=${shellQuote(expandHome(instance.homeDir || path.join(config.instanceRoot, instance.id)))}
export CFFIXED_USER_HOME="$HOME"
export TMPDIR=${shellQuote((expandHome(instance.tmpDir || path.join(config.tmpRoot, instance.id))).replace(/\/$/, '') + '/')}
export WECHAT_MULTI_INSTANCE_ID=${shellQuote(instance.id)}
export WECHAT_MULTI_INSTANCE_NAME=${shellQuote(instance.name || instance.id)}
${Object.entries(parseEnvLines(config.defaultExtraEnv)).map(([k, v]) => `export ${k}=${shellQuote(v)}`).join('\n')}
${Object.entries(parseEnvLines(instance.extraEnv)).map(([k, v]) => `export ${k}=${shellQuote(v)}`).join('\n')}
${instance.enableTweak && (instance.tweakDylib || config.defaultTweakDylib) ? `export DYLD_INSERT_LIBRARIES=${shellQuote(expandHome(instance.tweakDylib || config.defaultTweakDylib))}` : ''}
mkdir -p "$HOME" "$TMPDIR"
exec ${shellQuote(wechatExecutable(config))}
`;
  await fsp.writeFile(path.join(macos, executableName), script, { mode: 0o755 });

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>zh_CN</string>
  <key>CFBundleDisplayName</key><string>${escapeXml(instance.name || instance.id)}</string>
  <key>CFBundleExecutable</key><string>${executableName}</string>
  <key>CFBundleIdentifier</key><string>local.wechatmulti.${escapeXml(instance.id)}</string>
  ${iconName ? `<key>CFBundleIconFile</key><string>${iconName}</string>` : ''}
  <key>CFBundleName</key><string>${escapeXml(instance.name || instance.id)}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>10.15</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`;
  await fsp.writeFile(path.join(contents, 'Info.plist'), plist, 'utf8');
  await execFileP('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', appPath], { timeout: 120000 });
  return { appPath, iconCopied: Boolean(iconName), iconSource };
}

async function createLaunchScript(config, instance) {
  await ensureInstanceDirs(config, instance);
  const dir = expandHome(config.launcherRoot);
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${instance.name || instance.id}.command`);
  const env = instanceEnv(config, instance);
  const script = `#!/bin/zsh
set -euo pipefail
export HOME=${shellQuote(env.HOME)}
export CFFIXED_USER_HOME="$HOME"
export TMPDIR=${shellQuote(env.TMPDIR)}
export WECHAT_MULTI_INSTANCE_ID=${shellQuote(instance.id)}
export WECHAT_MULTI_INSTANCE_NAME=${shellQuote(instance.name || instance.id)}
${env.DYLD_INSERT_LIBRARIES ? `export DYLD_INSERT_LIBRARIES=${shellQuote(env.DYLD_INSERT_LIBRARIES)}` : ''}
${Object.entries(parseEnvLines(config.defaultExtraEnv)).map(([k, v]) => `export ${k}=${shellQuote(v)}`).join('\n')}
${Object.entries(parseEnvLines(instance.extraEnv)).map(([k, v]) => `export ${k}=${shellQuote(v)}`).join('\n')}
mkdir -p "$HOME" "$TMPDIR"
exec ${shellQuote(wechatExecutable(config))}
`;
  await fsp.writeFile(file, script, { mode: 0o755 });
  return { scriptPath: file };
}

async function migrateInstanceHome(config, instance, body = {}) {
  const enriched = (await enrichInstances(config)).find(i => i.id === instance.id);
  if (enriched && enriched.running) {
    throw Object.assign(new Error('实例正在运行，请先停止再迁移数据目录'), { status: 409 });
  }
  const oldHome = expandHome(instance.homeDir || path.join(config.instanceRoot, instance.id));
  const oldTmp = expandHome(instance.tmpDir || path.join(config.tmpRoot, instance.id));
  const newHome = expandHome(body.homeDir || persistentHomeFor(config, instance));
  const newTmp = expandHome(body.tmpDir || persistentTmpFor(config, instance));
  if (path.resolve(oldHome) === path.resolve(newHome)) {
    instance.tmpDir = newTmp;
    await ensureInstanceDirs(config, instance);
    await saveConfig(config);
    return { migrated: false, message: 'home already persistent', homeDir: newHome, tmpDir: newTmp };
  }
  await fsp.mkdir(path.dirname(newHome), { recursive: true });
  await fsp.mkdir(newTmp, { recursive: true });
  try {
    await fsp.access(oldHome);
    await execFileP('/usr/bin/rsync', ['-a', `${oldHome.replace(/\/$/, '')}/`, `${newHome.replace(/\/$/, '')}/`], { timeout: 600000 });
  } catch (err) {
    if (err.code === 'ENOENT') await fsp.mkdir(newHome, { recursive: true });
    else throw err;
  }
  instance.homeDir = newHome;
  instance.tmpDir = newTmp;
  instance.migratedAt = new Date().toISOString();
  await ensureInstanceDirs(config, instance);
  await saveConfig(config);
  return { migrated: true, oldHome, homeDir: newHome, oldTmp, tmpDir: newTmp };
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]));
}

async function openPath(target) {
  const p = expandHome(target);
  await fsp.mkdir(path.extname(p) ? path.dirname(p) : p, { recursive: true }).catch(() => {});
  return execFileP('/usr/bin/open', [p], { timeout: 10000 });
}

async function antirecall(config, body) {
  const tool = expandHome(body.tool || config.antirecallTool);
  const app = expandHome(body.app || config.wechatApp);
  const patchConfig = expandHome(body.config || config.antirecallConfig || '');
  const args = ['install', '--with-tip', '--block-update', '--multi-instance', '--app', app];
  if (patchConfig) args.push('--config', patchConfig);
  if (body.noBackup !== false) args.push('--no-backup');
  if (body.dryRun !== false) args.push('--dry-run');
  const result = await execFileP(tool, args, { timeout: 180000 });
  return { command: [tool, ...args], ...result };
}

async function updateConfig(body) {
  const config = await ensureConfig();
  const pathKeys = ['wechatApp', 'instanceRoot', 'launcherRoot', 'tmpRoot', 'antirecallTool', 'antirecallConfig', 'tweakTool', 'defaultTweakDylib'];

  if (body.resetPaths === true || body.useDefaults === true) {
    for (const key of pathKeys) {
      if (key === 'tweakTool' || key === 'defaultTweakDylib') {
        config[key] = '';
      } else if (key === 'antirecallTool') {
        config[key] = resolveAntirecallTool(DEFAULTS.antirecallTool);
      } else {
        config[key] = DEFAULTS[key];
      }
    }
  }

  for (const key of pathKeys) {
    if (body[key] !== undefined) config[key] = expandHome(String(body[key] || ''));
  }
  if (body.defaultExtraEnv !== undefined) config.defaultExtraEnv = String(body.defaultExtraEnv);

  if (config.antirecallTool) config.antirecallTool = resolveAntirecallTool(config.antirecallTool);
  if (!config.antirecallConfig) config.antirecallConfig = DEFAULTS.antirecallConfig;

  await saveConfig(config);
  return ensureConfig();
}

async function createBatchInstances(config, body) {
  const prefix = String(body.prefix || '微信小号').trim() || '微信小号';
  const count = Math.max(1, Math.min(50, Number(body.count || 1)));
  const start = Number(body.start || 1);
  const presetKeys = Object.keys(ICON_PRESETS);
  const created = [];
  for (let i = 0; i < count; i++) {
    const n = start + i;
    const name = `${prefix} ${n}`;
    const id = slugify(`${prefix}-${n}`).toLowerCase();
    const iconPreset = body.iconPreset === 'cycle' ? presetKeys[i % presetKeys.length] : String(body.iconPreset || presetKeys[i % presetKeys.length]);
    const inst = await createInstance(config, {
      name,
      id,
      iconPreset,
      iconLabel: String(n),
      notes: String(body.notes || '')
    });
    created.push(inst);
  }
  return created;
}

async function health(config) {
  const checks = {};
  async function exists(label, p, mode) {
    try {
      await fsp.access(expandHome(p), mode || fs.constants.F_OK);
      checks[label] = { ok: true, path: expandHome(p) };
    } catch (err) {
      checks[label] = { ok: false, path: expandHome(p), error: err.message };
    }
  }
  await exists('wechatApp', config.wechatApp);
  await exists('wechatExecutable', wechatExecutable(config), fs.constants.X_OK);
  await exists('antirecallTool', config.antirecallTool, fs.constants.X_OK);
  await exists('antirecallConfig', config.antirecallConfig);
  await exists('instanceRoot', config.instanceRoot);
  await exists('launcherRoot', config.launcherRoot);
  if (config.defaultTweakDylib) await exists('defaultTweakDylib', config.defaultTweakDylib);
  return { configPath: CONFIG_PATH, checks };
}

async function routeApi(req, res, pathname, method) {
  let config = await ensureConfig();

  if (pathname === '/api/auth/status' && method === 'GET') {
    return sendJson(res, 200, { auth: authStatus(config) });
  }

  if (pathname === '/api/auth/setup' && method === 'POST') {
    if (authStatus(config).configured) return sendJson(res, 409, { error: 'token already configured', auth: authStatus(config) });
    const body = await readJsonBody(req);
    const token = String(body.token || '').trim();
    if (token.length < 6) return sendJson(res, 400, { error: 'token must be at least 6 characters' });
    const hashed = hashToken(token);
    config.auth = { tokenSalt: hashed.salt, tokenHash: hashed.hash, createdAt: new Date().toISOString() };
    await saveConfig(config);
    return sendJson(res, 201, { auth: authStatus(config) });
  }

  if (pathname === '/api/auth/verify' && method === 'POST') {
    const body = await readJsonBody(req);
    if (!authStatus(config).configured) return sendJson(res, 200, { ok: false, auth: authStatus(config) });
    const ok = verifyToken(config, String(body.token || ''));
    return sendJson(res, ok ? 200 : 401, ok ? { ok: true, auth: authStatus(config) } : { error: 'invalid token', auth: authStatus(config) });
  }

  if (await requireAuth(req, res, config)) return;

  if (pathname === '/api/state' && method === 'GET') {
    return sendJson(res, 200, {
      config: publicConfig(config),
      configPath: CONFIG_PATH,
      meta: runtimeMeta(config),
      iconPresets: ICON_PRESETS,
      health: await health(config),
      instances: await enrichInstances(config),
      auth: authStatus(config)
    });
  }

  if (pathname === '/api/config' && method === 'PUT') {
    const body = await readJsonBody(req);
    config = await updateConfig(body);
    return sendJson(res, 200, {
      config: publicConfig(config),
      meta: runtimeMeta(config),
      health: await health(config),
      auth: authStatus(config)
    });
  }

  if (pathname === '/api/instances' && method === 'POST') {
    const body = await readJsonBody(req);
    const inst = await createInstance(config, body);
    return sendJson(res, 201, { instance: inst, instances: await enrichInstances(config) });
  }

  if (pathname === '/api/instances/batch' && method === 'POST') {
    const body = await readJsonBody(req);
    const created = await createBatchInstances(config, body);
    return sendJson(res, 201, { created, instances: await enrichInstances(config) });
  }

  const instanceMatch = pathname.match(/^\/api\/instances\/([^/]+)(?:\/(launch|stop|launcher|script|migrate|open-home|open-launcher))?$/);
  if (instanceMatch) {
    const id = decodeURIComponent(instanceMatch[1]);
    const action = instanceMatch[2] || '';
    const inst = config.instances.find(i => i.id === id);
    if (!inst) return sendJson(res, 404, { error: 'instance not found' });

    if (!action && method === 'PUT') {
      const body = await readJsonBody(req);
      const updated = await updateInstance(config, id, body);
      return sendJson(res, 200, { instance: updated, instances: await enrichInstances(config) });
    }

    if (!action && method === 'DELETE') {
      const enriched = (await enrichInstances(config)).find(i => i.id === id);
      if (enriched && enriched.running) return sendJson(res, 409, { error: 'instance is running; stop it first' });
      config.instances = config.instances.filter(i => i.id !== id);
      await saveConfig(config);
      return sendJson(res, 200, { deleted: id, instances: await enrichInstances(config) });
    }

    if (action === 'launch' && method === 'POST') {
      const result = await launchInstance(config, inst);
      return sendJson(res, 200, { launched: true, ...result });
    }
    if (action === 'stop' && method === 'POST') {
      const result = await stopInstance(config, inst);
      return sendJson(res, 200, result);
    }
    if (action === 'launcher' && method === 'POST') {
      const result = await createLauncher(config, inst);
      return sendJson(res, 200, result);
    }
    if (action === 'script' && method === 'POST') {
      const result = await createLaunchScript(config, inst);
      return sendJson(res, 200, result);
    }
    if (action === 'migrate' && method === 'POST') {
      const body = await readJsonBody(req);
      const result = await migrateInstanceHome(config, inst, body);
      return sendJson(res, 200, result);
    }
    if (action === 'open-home' && method === 'POST') {
      const result = await openPath(inst.homeDir || path.join(config.instanceRoot, inst.id));
      return sendJson(res, 200, result);
    }
    if (action === 'open-launcher' && method === 'POST') {
      const result = await openPath(launcherPath(config, inst));
      return sendJson(res, 200, result);
    }
  }

  if (pathname === '/api/antirecall' && method === 'POST') {
    const body = await readJsonBody(req);
    const result = await antirecall(config, body);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/open-config-dir' && method === 'POST') {
    return sendJson(res, 200, await openPath(CONFIG_DIR));
  }

  return sendJson(res, 404, { error: 'not found' });
}

async function serveStatic(req, res, pathname) {
  let file = pathname === '/' ? '/index.html' : pathname;
  file = decodeURIComponent(file);
  const full = path.normalize(path.join(PUBLIC_DIR, file));
  if (!full.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Forbidden');
  try {
    const data = await fsp.readFile(full);
    const ext = path.extname(full);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') return sendText(res, 404, 'Not found');
    throw err;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || HOST}`);
    if (url.pathname.startsWith('/api/')) {
      await routeApi(req, res, url.pathname, req.method || 'GET');
    } else {
      await serveStatic(req, res, url.pathname);
    }
  } catch (err) {
    console.error(err);
    sendJson(res, err.status || 500, { error: err.message || String(err), stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`WeChat Multi Manager listening on http://${HOST}:${PORT}`);
  console.log(`Config: ${CONFIG_PATH}`);
});
