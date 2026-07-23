<p align="center">
  <img src="https://ld.xh.do/ld-badge.svg" alt="认可 linux.do" width="480">
</p>

# touch-wechat-hacker

macOS 微信工具 monorepo：

- `packages/multi-manager`：Next.js + KumoUI 管理端 + Node API
- `packages/antirecall`：微信 4 防撤回 / 屏蔽更新 / 多开补丁工具

> 只建议在本机 loopback 使用。补丁安装会修改 `/Applications/WeChat.app` 并重签名，务必先完全退出微信，并优先 dry-run。

## 目录结构

```text
touch-wechat-hacker/
├── packages/
│   ├── multi-manager/     # Next.js + KumoUI + Node API + Tauri
│   └── antirecall/        # Swift 补丁 CLI + runtime dylib
├── scripts/
│   ├── build-antirecall.sh
│   └── run-antirecall.sh
├── package.json
└── README.md
```

## 快速开始

```bash
cd /Users/talexdreamsoul/Workspace/Projects/touch-wechat-hacker

# 安装依赖 + 编译补丁工具
npm run setup

# 终端 1：API
npm run dev:server

# 终端 2：Next UI
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:5173
```

API：

```text
http://127.0.0.1:17329
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run setup` | 安装 multi-manager 依赖并 release 编译 antirecall |
| `npm run dev` | 启动 Next.js + KumoUI 前端 |
| `npm run dev:server` | 启动 Node API |
| `npm run build` | 构建 Next 前端 |
| `npm run start` | 仅启动 API |
| `npm run antirecall:build` | `swift build -c release` |
| `npm run antirecall:versions` | 查看当前微信版本是否支持 |
| `npm run antirecall:dry-run` | 防撤回+屏蔽更新+多开 dry-run |
| `npm run tauri:build` | 打包桌面 `.app` |

直接调用补丁工具：

```bash
bash scripts/run-antirecall.sh versions
bash scripts/run-antirecall.sh install --with-tip --block-update --multi-instance --dry-run
```

## 两个包如何协作

`multi-manager` 默认会调用 monorepo 内的 antirecall 产物：

```text
packages/antirecall/.build/release/wechat-antirecall
packages/antirecall/patches-268601-multi-experimental-v2.json
```

管理端 UI 的「补丁」按钮会执行：

```bash
wechat-antirecall install \
  --with-tip \
  --block-update \
  --multi-instance \
  --app /Applications/WeChat.app \
  --config <patches.json> \
  --no-backup \
  [--dry-run]
```

配置文件：

```text
~/.touch-wechat-hacker/config.json
```

兼容旧路径 `~/.wechat-multi-manager/config.json`：首次启动会自动迁移，并把失效的 `antirecallTool` / `antirecallConfig` / 系统 TMP 临时目录切到 monorepo 默认值。全局配置页也可一键“恢复 monorepo 默认路径”。

## 多开原理

每个实例使用独立环境变量：

```bash
HOME="<instance-home>"
CFFIXED_USER_HOME="<instance-home>"
TMPDIR="<instance-tmp>"
/Applications/WeChat.app/Contents/MacOS/WeChat
```

实例数据默认目录：

```text
~/Library/Application Support/WeChatMulti/Instances
```

启动器默认目录：

```text
~/Applications/WeChat Multi
```

临时目录默认：

```text
~/Library/Caches/WeChatMulti/tmp
```

## 包内说明

- 管理端细节：`packages/multi-manager/README.md`
- 补丁工具细节 / 版本矩阵 / 恢复备份：`packages/antirecall/README.md`

## 安全 / 法律 / 风险声明

**本项目仅供个人学习、安全研究与本地技术验证。**

- 作者与贡献者**不承担**因使用本工具导致的法律责任、账号处罚、数据丢失、设备损坏或服务中断。
- 多开 / 防撤回 / 屏蔽更新 / 注入 / 重签名等行为**可能不稳定**，存在功能异常、闪退、无法更新，以及**临时或永久封号**风险。
- 补丁会修改 `/Applications/WeChat.app` 并重签名；未知微信构建号会被拒绝，但仍不保证兼容所有环境。
- 管理端默认只绑定 `127.0.0.1`，请勿暴露到公网。
- 首次打开网页端会强制弹出超详细确认引导；未勾选确认前不能继续。确认写入浏览器 `localStorage` 键：`touch-wechat-hacker-onboarding-v1`。
- 不建议多个实例共享同一数据目录。
- WeChatTweak / 自定义 dylib 注入属于实验能力，可能被 hardened runtime / SIP 拦截。

仓库：https://github.com/TalexDreamSoul/touch-wechat-hacker
