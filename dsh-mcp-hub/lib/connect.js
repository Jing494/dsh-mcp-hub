/**
 * One remote MCP connection: transport choice, handshake, and tool discovery.
 *
 * Transports:
 *  - `streamable-http` — the modern `POST` endpoint (must accept both JSON and
 *    `text/event-stream`; servers that only accept JSON answer 406).
 *  - `sse` — the legacy `GET /sse` endpoint plus its `message` POST target.
 *  - `auto` — try streamable first, then fall back to SSE.
 *
 * The official Node client ships no SSE transport (only stdio and streamable
 * HTTP), so this uses `@modelcontextprotocol/sdk` 1.30, which carries both.
 */
/**
 * The MCP SDK is loaded lazily so a resolution problem degrades one connection
 * attempt with a readable message instead of failing plugin activation.
 */
let sdkPromise
function loadSdk() {
  sdkPromise ??= Promise.all([
    import('@modelcontextprotocol/sdk/client/index.js'),
    import('@modelcontextprotocol/sdk/client/streamableHttp.js'),
    import('@modelcontextprotocol/sdk/client/sse.js'),
  ]).then(([index, streamableHttp, sse]) => ({
    Client: index.Client,
    StreamableHTTPClientTransport: streamableHttp.StreamableHTTPClientTransport,
    SSEClientTransport: sse.SSEClientTransport,
  }))
  return sdkPromise
}

/** Human-readable failure text: never swallowed, never translated. */
export function errorText(error) {
  if (error === undefined || error === null) return 'unknown error'
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const cause = error.cause
    const tail = cause === undefined ? '' : ` (${cause instanceof Error ? cause.message : String(cause)})`
    return `${error.message}${tail}`
  }
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/** Transports to attempt, in order, for a configured `transport` value. */
function transportOrder(transport) {
  if (transport === 'sse') return ['sse']
  if (transport === 'http') return ['http']
  return ['http', 'sse']
}

function createTransport(sdk, kind, url, headers, signal) {
  const target = new URL(url)
  const requestInit = { headers, signal }
  return kind === 'sse'
    ? new sdk.SSEClientTransport(target, { requestInit })
    : new sdk.StreamableHTTPClientTransport(target, { requestInit })
}

/** Page through `tools/list` until the server stops returning a cursor. */
async function listAllTools(client) {
  const tools = []
  let cursor
  for (let page = 0; page < 50; page += 1) {
    const result = await client.listTools(cursor === undefined ? undefined : { cursor })
    if (Array.isArray(result?.tools)) tools.push(...result.tools)
    cursor = result?.nextCursor
    if (cursor === undefined || cursor === null || cursor === '') break
  }
  return tools
}

/**
 * Connect to one server and collect its first tool generation.
 * @param server - a validated server config entry.
 * @returns the live client and discovery result, or every attempt's failure.
 */
export async function connectServer(server) {
  const attempts = []
  const startedAt = Date.now()

  let sdk
  try {
    sdk = await loadSdk()
  } catch (error) {
    return {
      ok: false,
      attempts: [{ transport: 'sdk', error: errorText(error) }],
      latencyMs: Date.now() - startedAt,
      error: `cannot load @modelcontextprotocol/sdk: ${errorText(error)}`,
    }
  }

  for (const kind of transportOrder(server.transport)) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('timed out')), server.timeoutMs)
    let client
    try {
      client = new sdk.Client(
        { name: 'dsh-mcp-hub', version: '0.1.0' },
        { capabilities: {} },
      )
      const transport = createTransport(sdk, kind, server.url, server.headers ?? {}, controller.signal)
      await client.connect(transport)
      const tools = await listAllTools(client)
      const info = typeof client.getServerVersion === 'function' ? client.getServerVersion() : undefined
      return {
        ok: true,
        client,
        transport: kind,
        tools,
        serverInfo: info ?? null,
        protocolVersion: typeof client.getNegotiatedProtocolVersion === 'function'
          ? client.getNegotiatedProtocolVersion()
          : undefined,
        latencyMs: Date.now() - startedAt,
        attempts,
      }
    } catch (error) {
      attempts.push({ transport: kind, error: errorText(error) })
      try {
        await client?.close()
      } catch {
        // the failed transport may already be gone
      }
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    ok: false,
    attempts,
    latencyMs: Date.now() - startedAt,
    error: attempts.map((attempt) => `${attempt.transport}: ${attempt.error}`).join(' | '),
  }
}

/** Flatten MCP content into model-visible text, keeping every block visible. */
export function contentToText(content) {
  if (!Array.isArray(content)) return content === undefined ? '' : String(content)
  return content
    .map((block) => {
      if (block === null || typeof block !== 'object') return String(block)
      if (block.type === 'text') return block.text ?? ''
      if (block.type === 'image') return `[image ${block.mimeType ?? 'unknown'}]`
      if (block.type === 'audio') return `[audio ${block.mimeType ?? 'unknown'}]`
      if (block.type === 'resource_link') return `[resource ${block.name ?? block.uri ?? ''}]`
      if (block.type === 'resource') return '[embedded resource]'
      return `[${block.type ?? 'unknown'} content]`
    })
    .join('\n')
}
