import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export interface HttpMcpOptions {
  name: string;
  version: string;
  port: number;
  host?: string;
  register: (server: McpServer) => void;
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

/**
 * Serves an MCP server over stateless Streamable HTTP at POST /mcp. Every request gets a fresh
 * McpServer + transport, so the process can be restarted or replaced by the deployer at any time.
 */
export function startHttpMcpServer(opts: HttpMcpOptions) {
  const host = opts.host ?? '127.0.0.1';
  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/healthz' && req.method === 'GET') return send(res, 200, { ok: true, name: opts.name, version: opts.version });
    if (url.pathname !== '/mcp') return send(res, 404, { error: 'not found' });
    if (req.method !== 'POST') {
      return send(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this server is stateless, use POST /mcp' }, id: null }, { allow: 'POST' });
    }
    let body: unknown;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
    }
    const server = new McpServer({ name: opts.name, version: opts.version });
    opts.register(server);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      console.error(`[${opts.name}]`, e);
      if (!res.headersSent) send(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  });
  http.listen(opts.port, host, () => console.log(`${opts.name} MCP server v${opts.version} on http://${host}:${opts.port}/mcp`));
  const stop = () => http.close(() => process.exit(0));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  return http;
}

/** True when this module is the process entry point (`tsx servers/x/src/index.ts`). */
export function isMain(importMetaUrl: string): boolean {
  return !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(importMetaUrl);
}

export function env(name: string, fallback?: string): string {
  const v = process.env[name]?.trim();
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing environment variable ${name}`);
}
