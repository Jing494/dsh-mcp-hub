// Standalone test for dsh-mcp-hub's connection layer, against the mock fixture.
// Run: node --import ./test/sdk-hook.mjs test/connect.test.mjs
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { connectServer, contentToText } from '../dsh-mcp-hub/lib/connect.js'

// Spawning the fixture needs a real node binary. On Termux/Android process.execPath is
// the dynamic linker, so DSH_NODE or the Termux prefix wins when either is set.
const NODE = (() => {
  const candidates = [
    process.env.DSH_NODE,
    process.env.PREFIX === undefined ? undefined : join(process.env.PREFIX, 'bin', 'node'),
    process.execPath,
  ]
  return candidates.find((candidate) => typeof candidate === 'string' && existsSync(candidate)) ?? process.execPath
})()
const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = 8734
const BASE = `http://127.0.0.1:${PORT}`

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const child = spawn(NODE, [join(HERE, '..', 'mock', 'server.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stderr.on('data', (d) => console.error('[mock]', String(d).trim()))
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('mock did not start')), 10000)
  child.stdout.on('data', (d) => {
    if (String(d).includes('listening')) {
      clearTimeout(timer)
      resolve()
    }
  })
})

const base = {
  id: 'srv',
  name: 'mock',
  enabled: true,
  headers: {},
  timeoutMs: 8000,
  toolAllow: [],
}

try {
  // 1. auto → streamable-http
  const auto = await connectServer({ ...base, transport: 'auto', url: `${BASE}/mcp` })
  check('auto falls onto streamable-http', auto.ok === true && auto.transport === 'http', `transport=${auto.transport} attempts=${auto.attempts.length}`)
  check('tools discovered', auto.ok && auto.tools.map((t) => t.name).sort().join(',') === 'add,echo', auto.ok ? auto.tools.map((t) => t.name).join(',') : String(auto.error))

  // 2. auto fallback: /sse is not a streamable endpoint
  const fallback = await connectServer({ ...base, transport: 'auto', url: `${BASE}/sse` })
  check('auto falls back to SSE', fallback.ok === true && fallback.transport === 'sse', `transport=${fallback.transport} attempts=${JSON.stringify(fallback.attempts.map((a) => a.transport))}`)
  check('fallback recorded the streamable failure', fallback.ok && fallback.attempts.length === 1, JSON.stringify(fallback.attempts[0] ?? {}).slice(0, 120))

  // 3. fixed SSE transport
  const sse = await connectServer({ ...base, transport: 'sse', url: `${BASE}/sse` })
  check('fixed sse transport connects', sse.ok === true && sse.transport === 'sse')

  // 4. fixed http transport must NOT silently downgrade
  const fixed = await connectServer({ ...base, transport: 'http', url: `${BASE}/sse` })
  check('fixed http transport fails without fallback', fixed.ok === false && fixed.attempts.length === 1, String(fixed.error).slice(0, 120))

  // 5. real call through the connected client
  const add = auto.ok ? auto.tools.find((t) => t.name === 'add') : undefined
  if (add !== undefined) {
    const called = await auto.client.callTool({ name: 'add', arguments: { a: 2, b: 40 } })
    const text = contentToText(called.content)
    check('add(2,40) returns 42', text.includes('42'), `text=${JSON.stringify(text)}`)
  } else {
    check('add(2,40) returns 42', false, 'tool missing')
  }

  await auto.client?.close?.()
  await fallback.client?.close?.()
  await sse.client?.close?.()
} finally {
  child.kill('SIGTERM')
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
