// Self-test: drive the fixture with the OFFICIAL MCP SDK client, so the mock
// is proven correct independently of dsh-mcp-hub (which does not exist yet).
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

// process.execPath is the Android linker, not node (PIE launched via linker64).
const NODE = (() => {
  const candidates = [
    process.env.DSH_NODE,
    process.env.PREFIX === undefined ? undefined : join(process.env.PREFIX, 'bin', 'node'),
    process.execPath,
  ];
  return candidates.find((candidate) => typeof candidate === 'string' && existsSync(candidate)) ?? process.execPath;
})();
// Point DSH_MCP_SDK_BASE at <sdk>/dist/esm when the SDK is not in this device's install.
const SDK = join(
  process.env.DSH_MCP_SDK_BASE
    ?? '/data/data/com.dsharnessmobile.shell/files/usr/lib/node_modules/@deepseek-ai/dsh/node_modules/@modelcontextprotocol/sdk/dist/esm',
  'client',
);
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8732;
const BASE = `http://127.0.0.1:${PORT}`;

const { Client } = await import(pathToFileURL(join(SDK, 'index.js')).href);
const { StreamableHTTPClientTransport } = await import(pathToFileURL(join(SDK, 'streamableHttp.js')).href);
const { SSEClientTransport } = await import(pathToFileURL(join(SDK, 'sse.js')).href);

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

const child = spawn(NODE, [join(HERE, 'server.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stderr.on('data', (d) => console.error('[mock]', String(d).trim()));
await new Promise((resolve, reject) => {
  child.stdout.on('data', (d) => String(d).includes('listening') && resolve());
  child.on('exit', (c) => reject(new Error(`mock exited ${c}`)));
  setTimeout(() => reject(new Error('mock start timeout')), 5000);
});

try {
  // 1) strict-server behaviour we want to reproduce
  const bad = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  });
  check('406 when Accept lacks text/event-stream', bad.status === 406, `status=${bad.status}`);

  // 2) Streamable HTTP through the real SDK client
  {
    const client = new Client({ name: 'selftest', version: '0.0.1' }, { capabilities: {} });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`)));
    const info = client.getServerVersion();
    const { tools } = await client.listTools();
    const echoed = await client.callTool({ name: 'echo', arguments: { text: 'streamable-ok' } });
    check('streamable: initialize', !!info?.name, `server=${info?.name} protocol=${client.getNegotiatedProtocolVersion?.() ?? '?'}`);
    check('streamable: tools/list', tools.length === 2, tools.map((t) => t.name).join(','));
    check('streamable: tools/call', echoed.content?.[0]?.text === 'streamable-ok', JSON.stringify(echoed.content?.[0]?.text));
    await client.close();
  }

  // 3) Legacy SSE through the real SDK client
  {
    const client = new Client({ name: 'selftest', version: '0.0.1' }, { capabilities: {} });
    await client.connect(new SSEClientTransport(new URL(`${BASE}/sse`)));
    const { tools } = await client.listTools();
    const sum = await client.callTool({ name: 'add', arguments: { a: 2, b: 40 } });
    check('sse: tools/list', tools.length === 2, tools.map((t) => t.name).join(','));
    check('sse: tools/call', sum.content?.[0]?.text === '42', JSON.stringify(sum.content?.[0]?.text));
    await client.close();
  }
} catch (err) {
  check('unexpected error', false, String(err?.stack ?? err));
} finally {
  child.kill();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
