# MCP Hub — 设计定稿（v0.1 远程 MCP 面板）

> 目标：DSH 设置页里出现「MCP」一栏，能加/改/删远程 MCP 服务器，能连接测试、列工具、手动调用一次；
> 升级 DSH 不冲突；纯插件，零上游改动。
>
> **v0.2 变更**：第 2 节原计划的两个包已合并为一个 `dsh-mcp-hub`（同时提供 host 半与浏览器半）。
> 行为与命名不变，只是少一次安装、少一行挂载。阅读第 2 节时请按此更新。

## 1. 范围

**做**
- 传输：`streamable-http`、`sse`（旧版），以及 `auto`（先试 http，失败降级 sse）
- 连接测试三步：握手 → 列工具/资源 → 手动调用
- 增删改、启用/停用、错误态展示
- 工具注册成 `mcp__<serverName>__<tool>`，模型可直接用

**不做（本期）**
- Skill 面板 / zip 导入 —— 整体推迟到 MCP 跑顺之后（用户 2026-10-18 拍板）
- `stdio` / 本地进程 / 本地 zip 导入
- OAuth 授权流程（先只支持 header 带 token）
- prompts 模板、resources 订阅
- 工具名冲突自动改名

## 2. 包结构（两个包）

| 包 | 侧 | 职责 |
|---|---|---|
| `dsh-mcp-hub` | host | config schema、连接管理、工具注册、状态机 |
| `dsh-client-ui-settings-mcp` | client (`dsh.client`) | 设置页那栏：列表 + 表单 + 测试弹窗 |

> 已拍板：UI 包用 `dsh-client-ui-settings-mcp`（官方设置栏命名风格），host 包用 `dsh-mcp-hub`。
> 若想合成单包（两个 half 放一个包，`dsh-client-file-upload` 就是这种形状），只是少一个 install 步骤，随时可合。

客户端包按上游惯例：`package.json` 里 `dsh.client.inject` 注入
`dsh-client-ui-settings`、`dsh-client-locale`、`dsh-client-ui-primitives`，
`exports["./client"]` 指向打包产物；host 侧 `apply()` 可为空（照抄
`dsh-client-ui-settings-web-search` 的形状）。

## 3. 为什么不跟升级冲突

1. 代码在 profile 自己的 `node_modules`（`dsh plugin add` 装的），不在 dsh 安装目录。
2. 挂载点写 **home 级 patch** `$DSH_HOME/cordis.patch.yml`（最上层、用户层），
   profile 重置 / 伴生配置被覆盖都不丢。
3. 服务器列表存插件自己的 config 字段（volatile），由 Settings 服务原子写入并校验 schema，
   不手改 YAML、不拼接字符串。
4. 卸载 = `dsh plugin remove` + 删数据目录。

## 4. 数据模型

```yaml
- id: mcp-hub
  name: dsh-mcp-hub
  config:
    servers:
      - id: gh                        # 稳定 slug
        name: github                  # 命名空间，[A-Za-z0-9_-]{1,32}
        enabled: true
        transport: auto               # auto | http | sse
        url: https://mcp.example.com/mcp
        headers:                      # 秘密值走 secret 标记，UI 只显示"已设置"
          Authorization: !!js '`Bearer ${process.env.MCP_TOKEN}`'
        timeoutMs: 15000
        toolAllow: []                 # 空=全开；填了就是白名单
```

派生状态（不落盘）：`idle | connecting | ready | error`，附 `tools[]`、`lastError`、`latencyMs`、`protocolVersion`。

## 5. 测试流程（面板交互）

```
[测试]
 ├─ 1 连通   initialize 握手 → 协议版本 / serverInfo / 耗时
 ├─ 2 能力   tools/list(分页) → 工具表：名 / 描述 / 必填参数
 └─ 3 调用   选一个工具 + JSON 参数 → 真实调用 → 原样返回 / 报错 / 耗时
```

失败时保留原始错误文本（不翻译、不吞），并给出最可能的三个原因：
URL 路径不对、需要 header、transport 选错。

## 6. auto 降级的现实细节

- Streamable HTTP：`POST`，`Accept: application/json, text/event-stream` 必须同时给，否则常见 406
- 旧 SSE：先 `GET /sse` 拿 `endpoint` 事件，再 POST 到该 message 端点
- auto 的顺序：先 streamable（15s 超时）→ 失败且错误属于「不像流式端点」→ 试 SSE
- 探测结果写回 `transport`，用户下次不用再猜

## 7. 风险与已知限制

- 远程 MCP server 质量参差；握手慢会拖住面板，标准库默认 60s 请求超时，面板级我们压到 15s
- 工具太多会污染工具表 → 提供 `toolAllow` 白名单
- header 里的 token 会进配置树；secret 标记只保证 UI 不回显，落盘仍是明文（与上游一致）
- 本地/内网地址（`127.0.0.1`、`192.168.*`）允许，不拦 SSRF（本机部署场景）

## 8. 里程碑

| 里程碑 | 交付 | 可验证 |
|---|---|---|
| M1 | 面板 + 增删改 + http 连接 + 工具列表 | 能看到真实 server 的工具有几个 |
| M2 | 测试调用 + SSE + auto 降级 | 点一下能拿到工具返回 |
| M3 | 重启保持 + 错误恢复 + 卸载清理 | 重启 DSH 后还在，删掉后无残留 |
| ~~M4~~ | ~~Skill 面板 + zip 导入~~ | 已被拍板推迟：MCP 跑顺再说 |

## 9. 已拍板

1. 包名：host `dsh-mcp-hub` + UI `dsh-client-ui-settings-mcp`
2. `auto` 降级探测：要，默认 `transport: auto`
3. 工具开关：默认全开，`toolAllow` 留空；需要时再填白名单

## 10. 实施前的准备

- 切 **创造模式**（标准 preset 没有 `cordis_inspect_*`，查 `ctx.tools` 注册/注销签名靠猜）
- **M0 先搭 mock**：本地起两个端点（streamable-http 一个、旧 SSE 一个），不依赖外网、不怕第三方 server 抽风；
  auto 降级的两种分支都能在 mock 上复现（200 / 406 / endpoint 事件）
- 真实 server 只作最后验收，避免调试期被别人的服务带偏
- 开工前 `undo_snapshot` 一张手动快照

## 11. 进展

- **2026-10-18 M0 完成**：`mock/server.mjs` 起两个传输端点（`POST /mcp` 流式 + `GET /sse` 旧版），
  `mock/selftest.mjs` 用官方 SDK 1.30.0 客户端回放，**6/6 通过**：
  406 复现、streamable 握手/列工具/调用、SSE 列工具/调用。
- **Android 坑（已踩）**：`process.execPath` 返回 `/apex/.../linker64` 而不是 node，
  `spawn(process.execPath, [script])` 会报 `bad ELF magic`。子进程必须用绝对 node 路径
  （`/data/data/com.dsharnessmobile.shell/files/usr/bin/node`）或 `DSH_NODE` 覆盖。
- **Skill 全线下线**：用户 2026-10-18 拍板「skill 等 MCP 做顺了再搞」，v0.1 只交付 MCP 面板。
