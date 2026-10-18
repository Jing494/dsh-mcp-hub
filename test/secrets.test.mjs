// Guards the two data-loss paths in the settings page:
//  - a `!!js` header expression must survive a write (the resolved value holds
//    plaintext, so writing it back would bake the secret into the profile patch);
//  - a tool-name collision must rename, and an unreachable free name must be
//    reported rather than silently dropping the tool.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { uniqueToolName, toolName } from '../dsh-mcp-hub/lib/tools.js'

const results = []
function check(name, ok, detail = '') {
  results.push({ ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

let captured
const fakeWindow = { __ModuleLoader__: { load: (definition) => { captured = definition } } }
const source = readFileSync(fileURLToPath(new URL('../dsh-mcp-hub/client.js', import.meta.url)), 'utf8')
new Function('window', source)(fakeWindow)

const stubReact = {
  createElement: () => null,
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
}
const module = captured.factory(() => stubReact)
const preserveExpressions = module.__test?.preserveExpressions
check('expression guard is testable', typeof preserveExpressions === 'function')

// ── the user layer keeps `!!js` whole; the resolved value does not ──────────
const expression = { __jsExpr: '`Bearer ${process.env.MCP_TOKEN}`' }
const rawServers = [
  { id: 'a', name: 'a', headers: expression },
  { id: 'b', name: 'b', headers: { Authorization: 'plain' } },
]

const written = preserveExpressions(
  [
    { id: 'a', name: 'a', url: 'https://x/mcp', headers: {} }, // resolved: expression already evaluated away
    { id: 'b', name: 'b', url: 'https://y/mcp', headers: { Authorization: 'plain' } },
  ],
  rawServers,
)

check('expression headers are restored on write', written[0].headers === expression, JSON.stringify(written[0].headers))
check('plain headers are left untouched', written[1].headers.Authorization === 'plain')
check('other fields keep the edit', written[0].url === 'https://x/mcp')

const fresh = { id: 'c', name: 'c', headers: { Authorization: 'new' } }
check('a newly added server is passed through', preserveExpressions([fresh], rawServers)[0] === fresh)

// ── tool-name collisions ───────────────────────────────────────────────────
const taken = new Set([toolName('a', 'x'), `${toolName('a', 'x')}_2`])
check('collision renames instead of dropping', uniqueToolName(toolName('a', 'x'), (n) => taken.has(n)) === `${toolName('a', 'x')}_3`)
check('no collision keeps the natural name', uniqueToolName(toolName('a', 'y'), (n) => taken.has(n)) === `mcp__a__y`)
check('exhausted names report undefined', uniqueToolName(toolName('a', 'x'), () => true, 3) === undefined)

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed === 0 ? 0 : 1)
