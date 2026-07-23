# WeChat Multi Manager

> 本包位于 monorepo：`touch-wechat-hacker/packages/multi-manager`。
>
> 前端已完全重构为 **Next.js + Cloudflare KumoUI**，不再保留 Vite / Tailwind / 自研 UI 样式。

本地管理器，用来快速管理 macOS 微信多实例、独立数据目录、启动器和补丁工具。

> API 只绑定 `127.0.0.1`，不要暴露到公网。所有修改类操作都尽量先 dry-run。

## 架构

- `server.js`：Node API（实例、配置、补丁）
- Next.js App Router：`app/` + `components/` + `lib/`
- UI：`@cloudflare/kumo`（standalone styles，无自定义主题）

## 启动

仓库根目录：

```bash
cd /Users/talexdreamsoul/Workspace/Projects/touch-wechat-hacker
npm install
```

开发模式（推荐）：

```bash
# 终端 1：API
npm run dev:server

# 终端 2：Next UI
npm run dev
```

或一键：

```bash
npm run dev:all -w wechat-multi-manager
```

- UI：`http://127.0.0.1:5173`
- API：`http://127.0.0.1:17329`

Next 会把 `/api/*` 代理到 API。

仅 API：

```bash
npm run start
```

开发地址：

```text
http://127.0.0.1:5173
```

## Tauri 桌面包

项目已接入 Tauri v2。桌面端会启动内置的本地 Node API 服务，并加载 `http://127.0.0.1:17329`，现有 Web 管理功能保持一致。

构建 `.app`：

```bash
npm run tauri:build
```

产物：

```text
src-tauri/target/release/bundle/macos/WeChat Multi Manager.app
```

构建 DMG：

```bash
npm run tauri:dmg
```

产物：

```text
src-tauri/target/release/bundle/dmg/WeChat Multi Manager_0.1.0_aarch64.dmg
```

说明：

- 构建时会复制当前 Node 运行时到 `src-tauri/bin/node`，并打入 `.app`，分发后不依赖用户 PATH 里的 `node`。
- `src-tauri/bin/node`、`src-tauri/target/` 和 `src-tauri/gen/` 都是生成产物，不纳入源码管理。
- 当前使用 ad-hoc 签名，适合本机/内部使用；正式分发给其他机器建议配置 Developer ID 和 notarization。
- 在受限沙箱里生成 DMG 可能遇到 `hdiutil: create failed - 设备未配置`，需要在正常 macOS 会话中执行。

## 访问 Token

首次打开页面会要求设置本地访问 token。设置后 token 只保存为 `scrypt` 哈希到配置文件中；后续访问页面和所有 `/api/*` 操作都需要输入 token 验证。

如果忘记 token，可以停止服务后编辑配置文件，删除 `auth` 字段，再重新启动并设置新的 token。

## 默认配置文件

```text
~/.touch-wechat-hacker/config.json
```

兼容读取旧路径 `~/.wechat-multi-manager/config.json`，启动时自动迁移到新路径。

默认实例数据根目录：

```text
~/Library/Application Support/WeChatMulti/Instances
```

默认启动器目录：

```text
~/Applications/WeChat Multi
```

默认临时目录：

```text
~/Library/Caches/WeChatMulti/tmp
```

## 多开原理

启动每个实例时设置不同环境变量：

```bash
HOME="<instance-home>"
CFFIXED_USER_HOME="<instance-home>"
TMPDIR="<instance-tmp>"
/Applications/WeChat.app/Contents/MacOS/WeChat
```

这样微信会把容器、`config.ini`、`xwechat_files` 等路径写入独立目录，避免主微信持有的 `config.ini` 导致第二实例卡住。

## 注意

- 不建议多个实例共享同一个数据目录。
- `wechat-antirecall install` 请先确保微信完全退出；工具本身也会检查运行状态。
- WeChatTweak/自定义 tweak 可能涉及注入或签名修改，建议只接入可信工具，并先 dry-run/备份。
