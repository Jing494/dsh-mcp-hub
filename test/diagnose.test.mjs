// Loads the browser module the same way the page does, then exercises the
// failure-to-cause mapping that M2 adds. No DOM and no React rendering needed.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const results = []
function check(name, ok, detail = '') {
  results.push({ ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

let captured
const fakeWindow = { __ModuleLoader__: { load: (definition) => { captured = definition } } }
const source = readFileSync(fileURLToPath(new URL('../dsh-mcp-hub/client.js', import.meta.url)), 'utf8')
new Function('window', source)(fakeWindow)

if (captured === undefined) {
  console.log('FAIL  module did not register through window.__ModuleLoader__')
  process.exit(1)
}
check('module registers an id', captured.id === 'dsh-mcp-hub', captured.id)

const stubReact = {
  createElement: () => null,
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
}
const module = captured.factory(() => stubReact)
check('factory exposes the test seam', typeof module.__test?.diagnose === 'function')

const { diagnose } = module.__test
const t = (key) => key

const cases = [
  ['auth 401 maps to header hint', { ok: false, error: 'HTTP 401 Unauthorized' }, ['hintHeader']],
  ['404 maps to wrong path', { ok: false, error: 'Streamable HTTP error: Error POSTing to endpoint: {"error":"not found"}' }, ['hintUrl']],
  ['406 maps to wrong transport', { ok: false, error: 'Not Acceptable 406, requires text/event-stream' }, ['hintTransport']],
  ['ECONNREFUSED maps to unreachable', { ok: false, error: 'fetch failed (connect ECONNREFUSED 127.0.0.1:8731)' }, ['hintRefused']],
  ['unknown error falls back to hintNone', { ok: false, error: 'something odd happened' }, ['hintNone']],
]

for (const [name, state, expected] of cases) {
  const got = diagnose(state, t)
  check(name, JSON.stringify(got) === JSON.stringify(expected), got.join(','))
}

// A fallback that failed on streamable then succeeded on SSE reports both texts.
const mixed = diagnose({
  ok: false,
  error: 'http: 404 not found | sse: 401 unauthorized',
  attempts: [{ transport: 'http', error: '404 not found' }, { transport: 'sse', error: '401 unauthorized' }],
}, t)
check('mixed failure caps at three hints', Array.isArray(mixed) && mixed.length <= 3, mixed.join(','))
check('mixed failure names the auth cause first', mixed[0] === 'hintHeader', mixed[0])
check('mixed failure also names the path cause', mixed.includes('hintUrl'), mixed.join(','))

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed === 0 ? 0 : 1)
