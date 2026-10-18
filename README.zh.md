[![](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#许可证) [![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

[English](./README.md) · [**中文**](./README.zh.md)

# dsh-mcp-hub

给 **DeepSeek Harness** 用的远程 [MCP](https://modelcontextprotocol.io) 服务器管理插件 —— 设置页、连接管理、工具注册，一个包（host 半 + 浏览器半，一行挂载）。

## 做什么

- **设置 → MCP**：增 / 改 / 启停 / 删服务器，测试连接，列出工具，并用 JSON 参数框手动调用一次。
- **传输**：`streamable-http`、旧版 `sse`，以及 `auto` —— 先试 streamable，失败自动降级 SSE，并记下实际生效的那一种。
- **工具**：发现的工具统一注册为 `mcp__<服务器名>__<工具名>`，模型可直接调用。
- **白名单**：每台服务器可配 `toolAllow`（留空 = 全开）。
- **不吞错**：原始错误始终完整展示，旁边附「路径不对 / 缺认证头 / 传输选错」三类常见原因提示。

## 依赖

- 带 web profile 的 DeepSeek Harness（本插件要渲染设置页）。
- Harness 自带的 MCP 客户端 SDK（`@modelcontextprotocol/sdk` 1.30+，已声明为 peer dependency）。

## 安装

尚未发布到 npm，从本地目录安装：

```sh
# 插件管理器（绝对路径指向包目录）
plugin_manager install_bundle /path/to/dsh-mcp-hub/dsh-mcp-hub

# 或用 CLI
dsh plugin add /path/to/dsh-mcp-hub/dsh-mcp-hub
```

然后重启一次 DSH。设置页里会出现 **MCP**（在「Agent 预设」和「快照」之间）。

> `package.json` 里把 `@deepseek-ai/*` 与 `@modelcontextprotocol/sdk` 放在 `peerDependencies` 是刻意的：
> 以 workspace 链接方式安装时，只有在这里声明过的名字才会被解析到宿主安装目录。

## 配置

服务器列表存在插件自己的 volatile config 里，由 Settings 服务原子写入：

```yaml
- id: mcp-hub
  name: dsh-mcp-hub
  config:
    servers:
      - id: weather
        name: weather                # 工具命名空间：mcp__weather__<tool>
        enabled: true
        transport: auto              # auto | http | sse
        url: https://example.com/mcp
        headers: {}                  # 例如 { Authorization: "Bearer ..." }
        timeoutMs: 15000             # 握手 / tools-list 预算
        toolCallTimeoutMs: 60000     # 单次工具调用预算
        toolAllow: []                # 留空 = 暴露全部工具
```

## 开发

```sh
# 连接层（对 mock 夹具，7 条断言）
node --import ./test/sdk-hook.mjs test/connect.test.mjs
# 工具适配（15）、失败诊断（10）、面板渲染冒烟（12）
node --import ./test/sdk-hook.mjs test/tools.test.mjs
node test/diagnose.test.mjs
node test/render.test.mjs
node test/secrets.test.mjs

# 夹具本身，双传输
cd mock && PORT=8731 node server.mjs
```

若 MCP SDK 无法从当前检出解析，显式指定：

```sh
DSH_MCP_SDK_BASE=/path/to/@modelcontextprotocol/sdk/dist/esm \
  node --import ./test/sdk-hook.mjs test/connect.test.mjs
```

目录：`dsh-mcp-hub/` 是插件本体（`index.js` host 半、`client.js` 浏览器半、`lib/` 传输与工具投影），
`mock/` 是无依赖的 MCP 夹具，`tools/` 放卸载清理脚本。

## 已知限制

- **只支持远程**：没有 `stdio`、不起本地进程。
- **没有 OAuth**：只支持 header token，且 token 会明文落进 profile patch（与上游一致）。
- **改 host 代码要重启 DSH**：HMR 只监听配置文件，不重载插件模块；只改客户端半边且刷新页面即可。
- **卸载要多一步，但有校验**：`remove_bundle`（或 `dsh plugin remove`）只清依赖与 bundle 选择，会留下 `- id: mcp-hub` 配置行和 `link:` 符号链接。`node tools/uninstall.mjs` 会在插件仍安装时拒绝执行，之后清掉这两处并**校验** profile 已干净；支持 `--dry-run`、`--keep-config`（保留服务器列表以便重装）、`--run-cli`。
- 工具名冲突会**自动改名**（`_2`、`_3`…）并在面板里显示；实在腾不出名字会报错而不是静默丢弃。
- **密钥**：header 值默认明文写在 profile patch 里；手写 Loader 表达式可避免，例如 `Authorization: !!js \`Bearer \${process.env.MCP_TOKEN}\``。面板在编辑时会保留这类表达式（从 user 层回填），但目前不能替你创建。

## 许可证

MIT，见 [LICENSE](./LICENSE)。
