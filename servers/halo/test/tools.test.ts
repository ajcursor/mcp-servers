import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@dazn-ops/mcp-kit';
import { connect, fakeFetch } from '@dazn-ops/mcp-kit/testing';
import { haloClient } from '../src/client.ts';
import { register } from '../src/index.ts';

const f = fakeFetch({
  'POST /change-records': (r) => ({ status: 201, body: { record: { id: 4821, number: '#4821', links: [], created_at: '', created_by: 'svc', url: '', ...r.body } } }),
});
const halo = haloClient(createApiClient({ system: 'HALO', baseUrl: 'http://halo.test/api/halo/v1', token: 't', fetch: f, retries: 0 }));
let mcp: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => { mcp = await connect((s) => register(s, { halo })); });
afterAll(() => mcp.close());

describe('halo MCP server', () => {
  it('create_change_record is the only tool and is a write tool', async () => {
    const tools = await mcp.tools();
    expect(tools.map((t) => t.name)).toEqual(['create_change_record']);
    expect(tools[0].annotations?.readOnlyHint).toBe(false);
  });

  it('logs the record and names it #4821 (step D8)', async () => {
    const r = await mcp.call('create_change_record', {
      title: 'Serie A R12 reschedule – Juventus vs Inter',
      summary: 'M-1207 moved to Sun 15 Nov 20:45 CET',
      actions: [
        { system: 'Xytech', action: 'FIB-12 moved to Sun 19:45–23:00', bot: 'Bookings Bot' },
        { system: 'Xytech', action: 'SAT-B booked, +£750', bot: 'Bookings Bot', approved_by: 'Ops user' },
      ],
    });
    expect(r.text.split('\n')[0]).toBe('Change record #4821 logged: Serie A R12 reschedule – Juventus vs Inter');
    expect(r.text).toContain('approved by Ops user');
  });

  it('rejects a record with no actions before calling HALO', async () => {
    const before = f.calls.length;
    const r = await mcp.call('create_change_record', { title: 'x', summary: 'y', actions: [] });
    expect(r.isError).toBe(true);
    expect(f.calls.length).toBe(before);
  });
});
