[![](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#license) [![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

[**English**](./README.md) · [中文](./README.zh.md)

# dsh-mcp-hub

Remote [MCP](https://modelcontextprotocol.io) servers for **DeepSeek Harness** — a settings page, connection management, and tool registration in one plugin (host half + browser half, one package, one loader row).

## What it does

- **Settings → MCP**: add / edit / enable-disable / delete servers, test a connection, list the server's tools, and run one call by hand from a JSON argument box.
- **Transports**: `streamable-http`, legacy `sse`, and `auto` — try streamable first, then fall back to SSE and record which one actually worked.
- **Tools**: every discovered tool is registered as `mcp__<serverName>__<toolName>`, so the model can call it directly.
- **Allowlist**: `toolAllow` per server (empty = all tools).
- **Honest failures**: the raw error text is always shown, next to hints for the three usual causes (wrong path, missing auth header, wrong transport).

## Requirements

- DeepSeek Harness with the web profile (this plugin renders a Settings page).
- The MCP client SDK shipped with Harness (`@modelcontextprotocol/sdk` 1.30+, declared as a peer dependency).

## Install

This package is not on npm yet; install it from a checkout:

```sh
# from the Harness plugin manager, with the absolute package directory
plugin_manager install_bundle /path/to/dsh-mcp-hub/dsh-mcp-hub

# or with the CLI
dsh plugin add /path/to/dsh-mcp-hub/dsh-mcp-hub
```

Then restart DSH once. The **MCP** entry appears in Settings (between *Agent presets* and *Undo*).

> The `package.json` declares `@deepseek-ai/*` and `@modelcontextprotocol/sdk` under `peerDependencies` on purpose: a plugin installed as a workspace link resolves host packages only for names declared there.

## Configure

Servers live in this plugin's own volatile config, written by the Settings service:

```yaml
- id: mcp-hub
  name: dsh-mcp-hub
  config:
    servers:
      - id: weather
        name: weather                # tool namespace: mcp__weather__<tool>
        enabled: true
        transport: auto              # auto | http | sse
        url: https://example.com/mcp
        headers: {}                  # e.g. { Authorization: "Bearer ..." }
        timeoutMs: 15000             # handshake / tools/list budget
        toolCallTimeoutMs: 60000     # per tool call
        toolAllow: []                # empty = expose every tool
```

## Development

```sh
# connection layer against the bundled mock fixture (7 assertions)
node --import ./test/sdk-hook.mjs test/connect.test.mjs
# tool adapter (15), failure diagnostics (10), panel render smoke test (12)
node --import ./test/sdk-hook.mjs test/tools.test.mjs
node test/diagnose.test.mjs
node test/render.test.mjs
node test/secrets.test.mjs

# the fixture itself, both transports
cd mock && PORT=8731 node server.mjs
```

If the MCP SDK is not resolvable from the checkout, point the tests at it:

```sh
DSH_MCP_SDK_BASE=/path/to/@modelcontextprotocol/sdk/dist/esm \
  node --import ./test/sdk-hook.mjs test/connect.test.mjs
```

Layout: `dsh-mcp-hub/` is the plugin (`index.js` host half, `client.js` browser half, `lib/` transports and tool projection), `mock/` is a dependency-free MCP fixture, `tools/` holds the uninstall helper.

## Releasing

Releases are automated and gated on CI — no personal access token is stored anywhere:

1. bump `version` in `dsh-mcp-hub/package.json`
2. push to `main`
3. the `test` matrix (node 22 + 24) must pass; then the `release` job packs the tarball, writes `SHA256SUMS`, and creates the tag plus the GitHub release

If that version is already tagged the release job skips, so ordinary commits never publish. It authenticates with GitHub's own per-run `GITHUB_TOKEN`.

## Limitations

- **Remote only.** No `stdio`, no local processes.
- **No OAuth.** Header tokens only, and they are stored in the profile patch in plaintext (same as upstream).
- **Host code changes need a DSH restart.** The HMR plugin watches config files, not plugin modules; client-only changes only need a page reload.
- **Uninstall needs one extra step, but it is checked:** `remove_bundle` (or `dsh plugin remove`) clears the dependency and the bundle selection and leaves the `- id: mcp-hub` config row plus the `link:` symlink behind. `node tools/uninstall.mjs` refuses to run while the plugin is still installed, then removes both leftovers and verifies the profile is clean. `--dry-run`, `--keep-config` (keep the server list for a reinstall) and `--run-cli` are supported.
- Tool-name collisions are renamed automatically (`_2`, `_3`, …) and shown in the panel; a name that cannot be freed is reported instead of silently dropped.
- **Secrets:** header values are plaintext in the profile patch unless you write a Loader expression by hand, for example `Authorization: !!js \`Bearer \${process.env.MCP_TOKEN}\``. The panel preserves such expressions across edits (it re-attaches them from the user layer), but it cannot create them for you.

## License

MIT — see [LICENSE](./LICENSE).
