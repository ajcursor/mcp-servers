import { afterAll, describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ApiError, cetRange, createApiClient, gbp, registerTools, startHttpMcpServer, tool } from '../src/index.ts';

describe('time + money', () => {
  it('formats CET ranges the way ops write them', () => {
    expect(cetRange('2026-11-15T20:30:00+01:00', '2026-11-15T22:30:00+01:00')).toBe('Sun 15 Nov 20:30–22:30');
    expect(cetRange('2026-11-15T18:45:00Z', '2026-11-15T22:00:00Z')).toBe('Sun 15 Nov 19:45–23:00');
    expect(cetRange('2026-11-14T22:00:00+01:00', '2026-11-15T01:30:00+01:00')).toBe('Sat 14 Nov 22:00–Sun 15 Nov 01:30');
    expect(gbp(4750)).toBe('£4,750');
  });
});

describe('createApiClient', () => {
  it('retries 5xx but not 4xx, and surfaces the vendor message', async () => {
    let n = 0;
    const flaky = (async () => (++n < 2 ? new Response('{}', { status: 503 }) : new Response('{"ok":true}'))) as typeof fetch;
    expect(await createApiClient({ system: 'X', baseUrl: 'http://x', token: 't', fetch: flaky }).get('/a')).toEqual({ ok: true });
    expect(n).toBe(2);
    let m = 0;
    const busy = (async () => { m++; return new Response('{"error":{"code":"resource_busy","message":"IRD-07 is held"}}', { status: 409 }); }) as typeof fetch;
    await expect(createApiClient({ system: 'Xytech', baseUrl: 'http://x', token: 't', fetch: busy }).post('/b')).rejects.toThrow('Xytech API 409 resource_busy: IRD-07 is held');
    expect(m).toBe(1);
  });

  it('reports an unreachable API clearly', async () => {
    const down = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    const err = await createApiClient({ system: 'DataMiner', baseUrl: 'http://x', token: 't', fetch: down, retries: 0 }).get('/c').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toContain("DataMiner API 0 unreachable: can't reach http://x");
  });
});

describe('registerTools', () => {
  it('refuses a write tool that does not say it needs approval', () => {
    const bad = tool<object>()({ name: 'do_it', title: 'Do it', write: true, description: 'Does a thing.', input: { a: z.string() }, run: async () => '' });
    expect(() => registerTools(new McpServer({ name: 't', version: '1' }), [bad], {})).toThrow('needs ops approval in chat');
  });
});

describe('startHttpMcpServer', () => {
  const echo = tool<object>()({ name: 'echo', title: 'Echo', description: 'Echo. Read only.', input: { text: z.string() }, run: async ({ text }) => text });
  const http = startHttpMcpServer({ name: 'kit-test', version: '1.0.0', port: 4299, register: (s) => registerTools(s, [echo], {}) });
  afterAll(() => { http.close(); });
  const post = (body: unknown) =>
    fetch('http://127.0.0.1:4299/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) });

  it('serves healthz, 405s GET /mcp, and answers stateless tool calls', async () => {
    await new Promise((r) => setTimeout(r, 100));
    expect((await fetch('http://127.0.0.1:4299/healthz')).status).toBe(200);
    expect((await fetch('http://127.0.0.1:4299/mcp')).status).toBe(405);
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    expect(((await init.json()) as any).result.serverInfo.name).toBe('kit-test');
    const call = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'echo', arguments: { text: 'hi' } } });
    expect(((await call.json()) as any).result.content[0].text).toBe('hi');
  });
});
