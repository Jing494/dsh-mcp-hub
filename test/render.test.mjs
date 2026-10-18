// Render smoke test: run the real section component against a minimal hook
// runtime, so a rendering crash (bad key, undefined variable, wrong style use)
// surfaces here instead of as a blank settings page.
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

// ── minimal hook runtime ─────────────────────────────────────────────────
let hooks = []
let hookIndex = 0
let pendingEffects = []

const ReactStub = {
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children: children.flat(Infinity) }
  },
  useState(initial) {
    const index = hookIndex
    hookIndex += 1
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
    const set = (next) => {
      hooks[index] = typeof next === 'function' ? next(hooks[index]) : next
    }
    return [hooks[index], set]
  },
  useEffect(fn) {
    hookIndex += 1
    pendingEffects.push(fn)
  },
  useCallback(fn) {
    hookIndex += 1
    return fn
  },
}

const module = captured.factory(() => ReactStub)
const Section = module.__test?.Section
check('component is exposed for rendering', typeof Section === 'function')

const servers = [
  { id: 'a', name: 'modelscope', url: 'https://example/mcp', transport: 'http', enabled: true, toolAllow: [] },
  { id: 'b', name: 'modelscope-sse', url: 'https://example/sse', transport: 'sse', enabled: false, toolAllow: ['tavily-search'] },
]

let describeCalls = 0
const remote = {
  async describe() {
    describeCalls += 1
    return {
      ok: true,
      value: { namespaces: [{ ns: 'mcp-hub', revision: 3, value: { servers } }] },
    }
  },
  async mutate() {
    return { ok: true, value: { revision: 4 } }
  },
}

const props = { t: (key) => key, remote: () => remote }

function render() {
  hookIndex = 0
  pendingEffects = []
  return Section(props)
}

// First render: loading; then flush the effect that loads the config.
let tree = render()
check('first render succeeds', tree !== undefined && Array.isArray(tree.children))
await Promise.all(pendingEffects.map((effect) => effect()))
await new Promise((resolve) => setTimeout(resolve, 20))

tree = render()
check('config load was requested', describeCalls > 0, `${describeCalls} describe call(s)`)

const flat = JSON.stringify(tree, (key, value) => (typeof value === 'function' ? '[fn]' : value))
check('renders the server names', flat.includes('modelscope') && flat.includes('modelscope-sse'))
check('renders the transport badges', flat.includes('"http"') && flat.includes('"sse"'))
check('disabled server shows its label', flat.includes('disabled'))
check('header exposes the add action', flat.includes('addServer'))
check('collapsed rows hide the test action', !flat.includes('"test"'), 'test button appears only when expanded')

// Expand the first row and render again: the action row must appear.
const serverPanel = tree.children.find(
  (child) => child?.children?.[0]?.children?.[0]?.props?.['aria-expanded'] !== undefined,
)
check('rows render as panels', serverPanel !== undefined, `${tree.children.length} top-level nodes`)

const chevron = serverPanel?.children?.[0]?.children?.[0]
check('a row exposes an expand toggle', typeof chevron?.props?.onClick === 'function')

chevron?.props?.onClick()
tree = render()
const flat2 = JSON.stringify(tree, (key, value) => (typeof value === 'function' ? '[fn]' : value))
check('expanding reveals the action buttons', flat2.includes('"test"') && flat2.includes('"edit"') && flat2.includes('"remove"'))
check('expanding reveals the allowlist input', flat2.includes('whitelistSave'))

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed === 0 ? 0 : 1)
