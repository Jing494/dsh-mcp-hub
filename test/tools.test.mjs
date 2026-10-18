// Smoke test for the MCP tool adapter: definition shape, naming, and render.
import { createToolDefinition, toolName, uniqueToolName } from '../lib/tools.js'
import { contentToText } from '../lib/connect.js'

const results = []
function check(name, ok, detail = '') {
  results.push({ ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const entry = {
  name: 'mock',
  client: {
    async callTool({ name, arguments: args }) {
      if (name === 'add') {
        return { content: [{ type: 'text', text: String(Number(args.a) + Number(args.b)) }], isError: false }
      }
      return { content: [{ type: 'text', text: 'bad tool' }], isError: true }
    },
  },
}

const definition = createToolDefinition(entry, {
  name: 'add',
  description: 'Add two numbers.',
  inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] },
})

check('tool name follows mcp__server__tool', definition.name === 'mcp__mock__add', definition.name)
check('description carried over', definition.description === 'Add two numbers.')
check('parameters are the MCP input schema', definition.parameters.required.join(',') === 'a,b')
check('output has schema and render', typeof definition.output?.render === 'function' && definition.output.schema !== undefined)

const value = await definition.execute({ a: 2, b: 40 }, {})
check('execute returns the MCP text', value.text === '42', JSON.stringify(value))
check('isError is false for a good call', value.isError === false)

const rendered = definition.output.render({ a: 2, b: 40 }, value)
check('render produces one text block', rendered.length === 1 && rendered[0].type === 'text' && rendered[0].text.includes('42'))

check('name builder', toolName('gh', 'listIssues') === 'mcp__gh__listIssues')

// Regression: the live entry carries the server under `server`, which is where
// the namespace must come from. A missing name must throw, never render
// `mcp__undefined__<tool>`.
const nested = createToolDefinition({ server: { name: 'gh' }, client: entry.client }, { name: 'add', inputSchema: { type: 'object' } })
check('namespace comes from entry.server.name', nested.name === 'mcp__gh__add', nested.name)

let threw = false
try {
  createToolDefinition({ client: entry.client }, { name: 'add', inputSchema: { type: 'object' } })
} catch {
  threw = true
}
check('nameless server throws instead of mcp__undefined__*', threw)

// content projection
check('content projection joins text blocks', contentToText([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }]) === 'a\nb')
check('content projection marks images', contentToText([{ type: 'image', mimeType: 'image/png' }]) === '[image image/png]')

// M2: the per-call bound reaches the registry, and a failed call is reported
// back to the owning connection instead of vanishing into the tool result.
const timed = createToolDefinition(
  { server: { name: 'mock', toolCallTimeoutMs: 1234 }, client: entry.client },
  { name: 'add', inputSchema: { type: 'object' } },
)
check('tool timeout comes from toolCallTimeoutMs', timed.timeoutMs === 1234, String(timed.timeoutMs))

let reported = null
const broken = createToolDefinition(
  {
    server: { name: 'mock' },
    client: { async callTool() { throw new Error('socket closed') } },
    onCallError: (error) => { reported = error },
  },
  { name: 'add', inputSchema: { type: 'object' } },
)
let failure = null
try {
  await broken.execute({}, {})
} catch (error) {
  failure = error
}
check('failing call throws with server and tool context', failure !== null && /mock\.add/.test(String(failure.message)), String(failure && failure.message))
check('failing call notifies the connection', reported !== null, String(reported && reported.message))

// M2+: a natural name that another server or plugin already owns is suffixed,
// never dropped, and an exhausted search reports instead of registering.
const taken = new Set(['mcp__a__x', 'mcp__a__x_2'])
check('free name is used as-is', uniqueToolName('mcp__a__y', (n) => taken.has(n)) === 'mcp__a__y')
check('taken name gets the first free suffix', uniqueToolName('mcp__a__x', (n) => taken.has(n)) === 'mcp__a__x_3')
check('exhausted search returns undefined', uniqueToolName('mcp__a__x', () => true, 3) === undefined)
check('name override reaches the definition', createToolDefinition(
  { server: { name: 'a' }, client: entry.client },
  { name: 'x', inputSchema: { type: 'object' } },
  'mcp__a__x_2',
).name === 'mcp__a__x_2')

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed === 0 ? 0 : 1)
