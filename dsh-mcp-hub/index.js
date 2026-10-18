/**
 * MCP Hub — host half.
 *
 * Owns the remote MCP server list as this plugin's own volatile config (the
 * kind of config the Settings service projects into a form and the Web UI can
 * read/write through `ctx.remote.settings`), connects to those servers, exposes
 * their tools as `mcp__<server>__<tool>`, and serves the small REST surface the
 * settings panel needs for a connection test and a manual call.
 *
 * Milestone M1: streamable-http with the `auto` → SSE fallback, tool listing,
 * one manual call. No stdio, no local processes.
 */
import z from '@deepseek-ai/schemastery'
import { connectServer, contentToText, errorText } from './lib/connect.js'
import { createToolDefinition, toolName, uniqueToolName } from './lib/tools.js'

export const name = 'dsh-mcp-hub'
export const inject = ['settings', 'tools']

/** Server name becomes the tool namespace: `mcp__<serverName>__<tool>`. */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

const Server = z.object({
  id: z.string().required(),
  name: z.string().required().pattern(SERVER_NAME_PATTERN),
  enabled: z.boolean().default(true),
  transport: z
    .union([z.const('auto'), z.const('http'), z.const('sse')])
    .default('auto'),
  url: z.string().required(),
  headers: z.dict(String).default({}),
  timeoutMs: z.number().min(1000).max(600000).default(15000),
  toolCallTimeoutMs: z.number().min(1000).max(600000).default(60000),
  toolAllow: z.array(String).default([]),
})

export const Config = z.object({
  servers: z.array(Server).default([]).volatile(),
})

/** Resolved config fields arrive as Value wrappers; read either shape. */
function readValue(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function'
    ? value.get()
    : value
}

function readServers(config) {
  const servers = readValue(config?.servers)
  return Array.isArray(servers) ? servers : []
}

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

/** Read a JSON request body with a hard size cap. */
function readJson(req) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 256 * 1024) {
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (raw === '') return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

/**
 * Same-origin fence for this plugin's own REST prefix.
 * A route registered under a longer prefix than `/api` is not covered by the
 * built-in `/api` guard, so it enforces the connection check itself.
 */
function makeAuthorizer(ctx) {
  return (req) => {
    let connection
    try {
      connection = ctx.get?.('connection')
    } catch {
      connection = undefined
    }
    if (typeof connection?.requestRejection === 'function') {
      try {
        return connection.requestRejection(req) === undefined ? undefined : { status: 401 }
      } catch {
        return { status: 401 }
      }
    }
    return undefined
  }
}

export function apply(ctx, config) {
  // This plugin renders its own Settings page; an automatic generated page
  // would duplicate it. Config and values stay untouched.
  ctx.effect(
    () => ctx.settings.configure({ auto: false }, ctx.fiber),
    'mcp-hub.settings-page',
  )

  /** Live connection state per configured server id. */
  const connections = new Map()

  const disposeEntry = (id) => {
    const entry = connections.get(id)
    if (entry === undefined) return
    connections.delete(id)
    for (const dispose of entry.disposers.splice(0)) {
      try {
        dispose()
      } catch {
        // a partially registered generation may already be gone
      }
    }
    Promise.resolve(entry.client?.close?.()).catch(() => {})
  }

  const disposeAll = () => {
    for (const id of [...connections.keys()]) disposeEntry(id)
  }
  ctx.effect(() => disposeAll, 'mcp-hub.connections')

  /** Connect one server, register its tools, and record the outcome. */
  const connectOne = async (server, { keepTools = true } = {}) => {
    disposeEntry(server.id)
    const result = await connectServer(server)
    if (!result.ok) {
      connections.set(server.id, {
        server,
        client: undefined,
        disposers: [],
        status: 'error',
        lastError: result.error,
        attempts: result.attempts,
        latencyMs: result.latencyMs,
        tools: [],
      })
      return { ...result, tools: [] }
    }

    const allow = Array.isArray(server.toolAllow) ? server.toolAllow : []
    const visible = allow.length === 0
      ? result.tools
      : result.tools.filter((tool) => allow.includes(tool.name))

    const entry = {
      server,
      client: result.client,
      disposers: [],
      status: 'ready',
      transport: result.transport,
      attempts: result.attempts,
      latencyMs: result.latencyMs,
      protocolVersion: result.protocolVersion,
      serverInfo: result.serverInfo,
      tools: visible,
      allTools: result.tools,
    }
    connections.set(server.id, entry)

    // A failed call is state the panel must see, not a silent tool error.
    entry.onCallError = (error) => {
      entry.status = 'error'
      entry.lastError = errorText(error)
    }

    if (keepTools) {
      entry.aliases = []
      for (const tool of visible) {
        const natural = toolName(server.name, tool.name)
        // Another server (or another plugin) may already own the natural name.
        // Rename instead of dropping, and record the rename for the panel.
        const registered = uniqueToolName(natural, (candidate) => ctx.tools.get(candidate) !== undefined)
        if (registered === undefined) {
          entry.registrationError = `mcp-hub: no free tool name for ${natural} (all ${20} suffixes are taken)`
          continue
        }
        if (registered !== natural) entry.aliases.push({ tool: tool.name, natural, registered })
        try {
          const dispose = ctx.tools.register(createToolDefinition(entry, tool, registered))
          entry.disposers.push(dispose)
        } catch (error) {
          // A registration failure must be visible, not silently dropped.
          entry.registrationError = errorText(error)
        }
      }
    }

    return { ...result, tools: visible }
  }

  const initial = readServers(config)
  console.log(`[mcp-hub] activated with ${initial.length} configured server(s)`)

  // Bring up the enabled servers without blocking startup.
  for (const server of initial) {
    if (server?.enabled === false || typeof server?.url !== 'string') continue
    void connectOne(server).catch((error) => {
      connections.set(server.id, {
        server,
        client: undefined,
        disposers: [],
        status: 'error',
        lastError: errorText(error),
        tools: [],
      })
    })
  }

  // ── REST surface for the Settings panel ────────────────────────────────
  // `webServer` may not be up while this plugin's own activation runs, so the
  // routes are registered from an injected child fiber rather than skipped.
  ctx.inject(['webServer'], (child) => {
    const webServer = child.webServer
    const authorize = makeAuthorizer(child)
    console.log('[mcp-hub] registering REST routes at /api/mcp-hub')

    child.effect(() => webServer.register({
      kind: 'prefix',
      path: '/api/mcp-hub',
      handler: async (req, res) => {
        const rejection = authorize(req)
        if (rejection !== undefined) {
          res.writeHead(rejection.status, { 'cache-control': 'no-store' })
          res.end()
          return
        }

        // Cross-origin POST must not pass; same-origin UI requests carry a matching Origin.
        const origin = req.headers?.origin
        if (typeof origin === 'string') {
          let same = false
          try {
            const parsed = new URL(origin)
            same = parsed.host === String(req.headers?.host ?? '')
          } catch {
            same = false
          }
          if (!same) {
            send(res, 403, { ok: false, error: 'cross-origin request rejected' })
            return
          }
        }

        let path
        let method
        try {
          const url = new URL(req.url ?? '/', 'http://dsh.local')
          path = url.pathname
          method = (req.method ?? 'GET').toUpperCase()
        } catch {
          send(res, 400, { ok: false, error: 'bad request url' })
          return
        }

        const servers = readServers(config)
        const findServer = (id) => servers.find((server) => server.id === id)

        try {
          if (method === 'GET' && path === '/api/mcp-hub/servers') {
            send(res, 200, {
              ok: true,
              servers: servers.map((server) => {
                const entry = connections.get(server.id)
                return {
                  ...server,
                  status: entry?.status ?? 'idle',
                  connectedTransport: entry?.transport,
                  lastError: entry?.lastError,
                  latencyMs: entry?.latencyMs,
                  protocolVersion: entry?.protocolVersion,
                  serverInfo: entry?.serverInfo,
                  aliases: entry?.aliases ?? [],
                  registrationError: entry?.registrationError,
                  tools: (entry?.tools ?? []).map((tool) => ({
                    name: tool.name,
                    description: tool.description ?? '',
                    required: tool.inputSchema?.required ?? [],
                  })),
                }
              }),
            })
            return
          }

          if (method === 'POST' && path === '/api/mcp-hub/test') {
            const body = await readJson(req)
            const server = findServer(body.id)
            if (server === undefined) {
              send(res, 404, { ok: false, error: `unknown server id ${JSON.stringify(body.id)}` })
              return
            }
            const result = await connectOne(server)
            send(res, 200, {
              ok: result.ok === true,
              transport: result.transport,
              connectedTransport: connections.get(server.id)?.transport,
              latencyMs: result.latencyMs,
              protocolVersion: result.protocolVersion,
              serverInfo: result.serverInfo,
              attempts: result.attempts ?? [],
              error: result.error,
              aliases: connections.get(server.id)?.aliases ?? [],
              registrationError: connections.get(server.id)?.registrationError,
              tools: (connections.get(server.id)?.tools ?? []).map((tool) => ({
                name: tool.name,
                description: tool.description ?? '',
                required: tool.inputSchema?.required ?? [],
              })),
            })
            return
          }

          if (method === 'POST' && path === '/api/mcp-hub/call') {
            const body = await readJson(req)
            const entry = connections.get(body.id)
            if (entry === undefined || entry.client === undefined) {
              send(res, 409, { ok: false, error: 'server is not connected; run the test first' })
              return
            }
            const startedAt = Date.now()
            try {
              const result = await entry.client.callTool({
                name: String(body.tool ?? ''),
                arguments: body.arguments ?? {},
              })
              entry.status = 'ready'
              entry.lastError = undefined
              send(res, 200, {
                ok: true,
                isError: result?.isError === true,
                text: contentToText(result?.content),
                structured: result?.structuredContent ?? null,
                latencyMs: Date.now() - startedAt,
              })
            } catch (error) {
              // A failed manual call is connection state too: show it next to
              // the server instead of only inside this response.
              entry.status = 'error'
              entry.lastError = errorText(error)
              send(res, 200, {
                ok: false,
                error: errorText(error),
                latencyMs: Date.now() - startedAt,
              })
            }
            return
          }

          send(res, 404, { ok: false, error: `no route for ${method} ${path}` })
        } catch (error) {
          send(res, 500, { ok: false, error: errorText(error) })
        }
      },
    }), 'mcp-hub.rest')
  })
}
