import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Connects an in-memory MCP client to a server, for unit tests. */
export async function connect(register: (server: McpServer) => void) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  register(server);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return {
    client,
    tools: async () => (await client.listTools()).tools,
    call: async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { type: string; text?: string }[] };
      return { isError: !!r.isError, text: r.content.map((c) => c.text ?? '').join('\n') };
    },
    close: () => Promise.all([client.close(), server.close()]),
  };
}

export interface FakeRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: any;
}
export type FakeRoute = (req: FakeRequest) => unknown | { status: number; body: unknown };

/** A fetch that answers from canned routes keyed "METHOD /path" (path params as :x). Records every request. */
export function fakeFetch(routes: Record<string, FakeRoute>) {
  const calls: FakeRequest[] = [];
  const compiled = Object.entries(routes).map(([key, fn]) => {
    const [method, pattern] = key.split(' ');
    const re = new RegExp('^' + pattern.replace(/:[a-z_]+/g, '[^/]+') + '$');
    return { method, re, fn };
  });
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? 'GET';
    const p = url.pathname.replace(/^\/api(\/[\w-]+)?\/v1/, '');
    const req: FakeRequest = { method, path: decodeURIComponent(p), query: Object.fromEntries(url.searchParams), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(req);
    const route = compiled.find((r) => r.method === method && r.re.test(req.path));
    if (!route) return new Response(JSON.stringify({ error: { code: 'not_found', message: `${method} ${req.path}` } }), { status: 404 });
    const out = route.fn(req) as { status?: number; body?: unknown };
    const isWrapped = out && typeof out === 'object' && 'status' in out && 'body' in out;
    return new Response(JSON.stringify(isWrapped ? out.body : out), { status: isWrapped ? out.status : 200 });
  }) as typeof fetch;
  return Object.assign(f, { calls });
}

export interface Sandbox {
  url: string;
  token: string;
  reset: () => Promise<void>;
  stop: () => void;
}

/**
 * A vendor sandbox for integration tests: `envUrl` if set (e.g. XYTECH_SANDBOX_URL), otherwise the sim
 * repo at `envDir` or the first of `defaultDirs` that exists, started with `npm run sandbox`.
 * Returns null when none is available, so suites can skip cleanly.
 */
export async function startSandbox(opts: { envUrl: string; envToken: string; envDir: string; defaultDirs: string[]; port: number; token: string }): Promise<Sandbox | null> {
  const token = process.env[opts.envToken] || opts.token;
  const fromEnv = process.env[opts.envUrl]?.replace(/\/+$/, '');
  const mk = (apiUrl: string, child?: ChildProcess): Sandbox => ({
    url: apiUrl,
    token,
    reset: async () => { await fetch(new URL('/admin/reset', apiUrl), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); },
    stop: () => {
      if (!child?.pid) return;
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); }
    },
  });
  if (fromEnv) return mk(fromEnv);
  const candidates = (process.env[opts.envDir] ? [process.env[opts.envDir]!] : opts.defaultDirs).map((d) => path.resolve(process.cwd(), d));
  const dir = candidates.find((d) => existsSync(path.join(d, 'package.json')) && existsSync(path.join(d, 'node_modules')));
  if (!dir) {
    console.warn(`[sandbox] no sandbox: set ${opts.envUrl}, or install the sim at ${candidates.join(' or ')}`);
    return null;
  }
  // Its own process group, so stop() also ends the server npm starts.
  const child = spawn('npm', ['run', '--silent', 'sandbox'], { cwd: dir, env: { ...process.env, PORT: String(opts.port) }, stdio: 'ignore', detached: true });
  const base = `http://127.0.0.1:${opts.port}`;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return mk(`${base}/api/v1`, child);
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  mk('', child).stop();
  console.warn(`[sandbox] ${dir} did not start on :${opts.port}`);
  return null;
}
