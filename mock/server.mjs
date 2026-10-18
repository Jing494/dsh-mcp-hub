// Minimal MCP test fixture: one server, both transports.
//   POST /mcp            → Streamable HTTP (JSON responses)
//   GET  /sse            → legacy SSE channel
//   POST /messages?...   → legacy SSE message endpoint
//   GET  /health         → plain JSON, for probing
// No dependencies. Purpose: exercise dsh-mcp-hub's transports, including the
// "Accept missing text/event-stream → 406" failure real servers produce.
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8731);
const HOST = '127.0.0.1';
const PROTOCOL_FALLBACK = '2025-06-18';

const TOOLS = [
  {
    name: 'echo',
    description: 'Echo the given text back. Fixture smoke test.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'add',
    description: 'Add two numbers.',
    inputSchema: {
      type: 'object',
      properties: { a: { type: 'number' }, b: { type: 'number' } },
      required: ['a', 'b'],
    },
  },
];

const sessions = new Map(); // legacy SSE: sessionId -> response stream

function send(res, code, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

function rpcOk(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function rpcErr(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function handleRpc(msg, { legacy } = {}) {
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize': {
      const requested = params?.protocolVersion;
      return rpcOk(id, {
        protocolVersion: requested ?? PROTOCOL_FALLBACK,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'mcp-hub-mock', version: '0.1.0' },
        instructions: 'Fixture server for MCP transport tests.',
      });
    }
    case 'ping':
      return rpcOk(id, {});
    case 'tools/list':
      return rpcOk(id, { tools: TOOLS });
    case 'tools/call': {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (name === 'echo') {
        return rpcOk(id, { content: [{ type: 'text', text: String(args.text ?? '') }] });
      }
      if (name === 'add') {
        const sum = Number(args.a) + Number(args.b);
        return rpcOk(id, { content: [{ type: 'text', text: String(sum) }] });
      }
      return rpcErr(id, -32602, `unknown tool: ${name}${legacy ? ' (sse)' : ''}`);
    }
    case 'resources/list':
      return rpcOk(id, { resources: [] });
    case 'prompts/list':
      return rpcOk(id, { prompts: [] });
    default:
      if (String(method).startsWith('notifications/')) return null; // no reply
      return rpcErr(id, -32601, `method not found: ${method}`);
  }
}

function collect(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname === '/health') {
    return send(res, 200, { ok: true, tools: TOOLS.length, transports: ['streamable-http', 'sse'] });
  }

  // ---------- Streamable HTTP ----------
  if (url.pathname === '/mcp' && req.method === 'POST') {
    const accept = String(req.headers.accept ?? '');
    // Real-world strictness: both types must be acceptable, else 406.
    if (!accept.includes('application/json') || !accept.includes('text/event-stream')) {
      return send(res, 406, rpcErr(null, -32000, 'Not Acceptable: require application/json, text/event-stream'), {
        'content-type': 'application/json',
      });
    }
    const raw = await collect(req);
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send(res, 400, rpcErr(null, -32700, 'parse error'));
    }
    const reply = handleRpc(msg);
    if (!reply) return send(res, 202, ''); // notification
    return send(res, 200, reply, {
      'mcp-session-id': req.headers['mcp-session-id'] ?? randomUUID(),
    });
  }
  if (url.pathname === '/mcp') return send(res, 405, { error: 'method not allowed' });

  // ---------- Legacy SSE ----------
  if (url.pathname === '/sse' && req.method === 'GET') {
    const sessionId = randomUUID();
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);
    sessions.set(sessionId, res);
    const keep = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(keep);
      sessions.delete(sessionId);
    });
    return;
  }
  if (url.pathname === '/messages' && req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');
    const stream = sessions.get(sessionId);
    if (!stream) return send(res, 400, { error: 'unknown session' });
    const raw = await collect(req);
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: 'parse error' });
    }
    const reply = handleRpc(msg, { legacy: true });
    if (reply) stream.write(`event: message\ndata: ${JSON.stringify(reply)}\n\n`);
    return send(res, 202, '');
  }

  return send(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`mock listening http://${HOST}:${PORT}  tools=${TOOLS.length}`);
});
