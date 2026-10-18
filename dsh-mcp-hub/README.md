[![](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE) [![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

# dsh-mcp-hub

Remote [MCP](https://modelcontextprotocol.io) servers for **DeepSeek Harness**: a Settings page, connection management, and `mcp__<server>__<tool>` registration in one plugin (host half + browser half).

Repository, docs and Chinese README: <https://github.com/Jing494/dsh-mcp-hub>

## Install

```sh
dsh plugin add dsh-mcp-hub          # from npm, when published
dsh plugin add ./dsh-mcp-hub-0.2.0.tgz   # from the release tarball
```

Then restart DSH once; the **MCP** entry appears in Settings.

## Configure

```yaml
- id: mcp-hub
  name: dsh-mcp-hub
  config:
    servers:
      - id: weather
        name: weather            # tool namespace: mcp__weather__<tool>
        enabled: true
        transport: auto          # auto | http | sse
        url: https://example.com/mcp
        headers: {}
        timeoutMs: 15000
        toolCallTimeoutMs: 60000
        toolAllow: []
```

## Requirements

- DeepSeek Harness `>=0.2.1-rc.2 <0.3.0` (declared as `engines.dsh`; installing or starting with an out-of-range runtime is refused).
- The MCP client SDK that Harness already ships (`@modelcontextprotocol/sdk` 1.30+, declared as a peer dependency).
- Node `^22.19.0 || >=24.0.0`.

## Notes

- Remote transports only: `streamable-http`, legacy `sse`, and `auto` (streamable first, SSE on failure). No `stdio`.
- Header tokens are stored in the profile patch in plaintext, same as upstream.
- `remove_bundle` does not clean up the config row or the `link:` symlinks; use `tools/uninstall-cleanup.mjs` from the repository.

MIT licensed.
