import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiClient } from '@dazn-ops/mcp-kit';
import { connect, startSandbox } from '@dazn-ops/mcp-kit/testing';
import { xytechClient } from '../src/client.ts';
import { register } from '../src/index.ts';

const SUN = { start: '2026-11-15T19:45:00+01:00', end: '2026-11-15T23:00:00+01:00' };
const sandbox = await startSandbox({
  envUrl: 'XYTECH_SANDBOX_URL', envToken: 'XYTECH_SANDBOX_TOKEN', envDir: 'MEDIAPULSE_SIM_DIR',
  defaultDirs: ['../mediapulse-sim', '.sandbox/mediapulse-sim'], port: 4952, token: 'sandbox-token',
});

describe.skipIf(!sandbox)('xytech MCP server against the Xytech sandbox', () => {
  let mcp: Awaited<ReturnType<typeof connect>>;
  beforeAll(async () => {
    const xytech = xytechClient(createApiClient({ system: 'Xytech', baseUrl: sandbox!.url, token: sandbox!.token }));
    mcp = await connect((s) => register(s, { xytech }));
  });
  beforeEach(() => sandbox!.reset());
  afterAll(async () => { await mcp?.close(); sandbox?.stop(); });

  it('lists the decoders', async () => {
    const r = await mcp.call('list_resources', { type: 'decoder' });
    expect(r.text).toContain('4 decoder resources');
    expect(r.text).toContain('IRD-11');
  });

  it('Sun 15 Nov has six work orders (step 2.11)', async () => {
    const r = await mcp.call('list_bookings', { date: '2026-11-15' });
    expect(r.text.split('\n')).toEqual([
      '6 work orders on Sun 15 Nov (CET):',
      "12:00–14:15 · WO-58244 Women's Serie A – Live · FIB-14, IRD-11 · Pending",
      '12:30–14:45 · WO-58233 Serie A R12 – Early Kick-off · FIB-12, IRD-09 · Confirmed',
      '15:00–17:15 · WO-58238 Serie A R12 – Afternoon Match · SAT-A, IRD-11 · Hold',
      '18:00–23:45 · WO-58236 NFL Sunday – Studio Feed · GW-01, IRD-05 · Pending',
      '19:00–23:30 · WO-58242 Coppa Italia – Preview Show · SAT-A, IRD-09 · Confirmed',
      '19:30–22:45 · WO-58240 Event B: Serie A R12 – Napoli vs Lazio · IRD-07 · Confirmed',
    ]);
  });

  it('finds IRD-07 held by Event B and SAT-A busy in the new window', async () => {
    const r = await mcp.call('get_availability', { resource_ids: ['FIB-12', 'SAT-A', 'SAT-B', 'IRD-07', 'IRD-11'], ...SUN });
    expect(r.text).toContain('✅ FIB-12 free');
    expect(r.text).toContain('❌ SAT-A busy: WO-58242');
    expect(r.text).toContain('✅ SAT-B free');
    expect(r.text).toContain('❌ IRD-07 busy: WO-58240');
    expect(r.text).toContain('✅ IRD-11 free');
  });

  it('prices SAT-B at the Sunday premium', async () => {
    expect((await mcp.call('get_rates', { resource_id: 'SAT-B', ...SUN })).text).toContain('£3,400');
  });

  it('refuses to move IRD-07 onto Event B', async () => {
    const r = await mcp.call('amend_booking', { booking_id: 'BKG-58231-02', ...SUN });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('WO-58240');
  });

  it('rebooks the match for Sunday: £4,750 against £4,000, approved', async () => {
    expect((await mcp.call('amend_booking', { booking_id: 'BKG-58231-01', ...SUN })).isError).toBe(false);
    expect((await mcp.call('amend_booking', { booking_id: 'BKG-58231-02', ...SUN, resource_id: 'IRD-11' })).isError).toBe(false);
    const sat = await mcp.call('create_booking', { work_order: 'WO-58231', resource_id: 'SAT-B', ...SUN, cost_approved_by: 'Ops user' });
    expect(sat.text).toContain('Released SAT-A');
    expect(sat.text).toContain('Cost: £4,750 booked vs £4,000 budget (+£750 over budget, approved by Ops user)');
  });
});
