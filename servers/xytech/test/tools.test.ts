import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@dazn-ops/mcp-kit';
import { connect, fakeFetch } from '@dazn-ops/mcp-kit/testing';
import { xytechClient } from '../src/client.ts';
import { register } from '../src/index.ts';
import type { Booking, WorkOrder } from '../src/schemas.ts';

const SUN = { start: '2026-11-15T19:45:00+01:00', end: '2026-11-15T23:00:00+01:00' };
const booking = (over: Partial<Booking>): Booking => ({
  id: 'BKG-58231-01', work_order: 'WO-58231', resource_id: 'FIB-12', resource_type: 'fibre', role: 'main',
  start: '2026-11-14T17:00:00+01:00', end: '2026-11-14T20:15:00+01:00', status: 'booked', rate: { amount: 1200, currency: 'GBP' }, approved_by: null, ...over,
});
const wo = (over: Partial<WorkOrder>): WorkOrder => ({
  work_order: 'WO-58231', description: 'Serie A R12 – Juventus vs Inter', alias: null, event_id: 'M-1207', phase: 'Confirmed', assigned_to: 'MCR Operator 1',
  start: '2026-11-14T17:00:00+01:00', end: '2026-11-14T20:15:00+01:00', resources: ['FIB-12', 'IRD-07', 'SAT-A'], ...over,
});
const HERO = wo({
  bookings: [booking({}), booking({ id: 'BKG-58231-02', resource_id: 'IRD-07', resource_type: 'decoder', rate: { amount: 150, currency: 'GBP' } }), booking({ id: 'BKG-58231-03', resource_id: 'SAT-A', role: 'backup', rate: { amount: 2250, currency: 'GBP' } })],
  cost: { budget: 4000, booked: 3600, projected: 3600, variance: -400, approval: { status: 'within budget' } },
});
const sunday = (n: string, desc: string, s: string, e: string, res: string[], phase: string, alias: string | null = null) =>
  wo({ work_order: n, description: desc, alias, event_id: null, phase, start: `2026-11-15T${s}:00+01:00`, end: `2026-11-15T${e}:00+01:00`, resources: res });

const f = fakeFetch({
  'GET /resources': (r) => ({ resources: [{ id: 'IRD-11', type: 'decoder', name: 'IRD · MCR rack 3', location: 'MCR Leeds rack 3' }].filter((x) => !r.query.type || x.type === r.query.type) }),
  'GET /availability': () => ({
    window: SUN,
    results: [
      { resource_id: 'FIB-12', type: 'fibre', available: true, conflicts: [] },
      { resource_id: 'SAT-A', type: 'satellite', available: false, conflicts: [{ kind: 'booking', booking_id: 'BKG-58242-01', work_order: 'WO-58242', description: 'Coppa Italia – Preview Show', start: '2026-11-15T19:00:00+01:00', end: '2026-11-15T23:30:00+01:00' }] },
      { resource_id: 'IRD-07', type: 'decoder', available: false, conflicts: [{ kind: 'booking', booking_id: 'BKG-58240-01', work_order: 'WO-58240', description: 'Serie A R12 – Napoli vs Lazio', start: '2026-11-15T20:30:00+01:00', end: '2026-11-15T22:30:00+01:00' }] },
      { resource_id: 'IRD-11', type: 'decoder', available: true, conflicts: [] },
    ],
  }),
  'GET /work-orders/WO-58231': () => HERO,
  'GET /work-orders': () => ({ work_orders: [HERO] }),
  'GET /bookings': () => ({
    bookings: [],
    work_orders: [
      sunday('WO-58244', "Women's Serie A – Live", '12:00', '14:15', ['FIB-14', 'IRD-11'], 'Pending'),
      sunday('WO-58240', 'Serie A R12 – Napoli vs Lazio', '19:30', '22:45', ['IRD-07'], 'Confirmed', 'Event B'),
    ],
  }),
  'GET /rates': () => ({ resource_id: 'SAT-B', rate_card: 'Satellite SAT-B · Sunday premium', amount: 3400, currency: 'GBP', basis: 'per event window' }),
  'POST /bookings': (r) => ({
    status: 201,
    body: {
      booking: booking({ id: 'BKG-58231-04', resource_id: r.body.resource_id, role: 'backup', ...SUN, rate: { amount: 3400, currency: 'GBP' }, approved_by: r.body.cost_approved_by ?? null }),
      released: [booking({ id: 'BKG-58231-03', resource_id: 'SAT-A', status: 'released' })],
      work_order: { ...HERO, cost: { budget: 4000, booked: 4750, projected: 4750, variance: 750, approval: { status: 'approved', approved_by: 'Ops user' } } },
    },
  }),
  'PATCH /bookings/BKG-58231-01': (r) => ({ booking: booking({ start: r.body.start, end: r.body.end }), previous: { resource_id: 'FIB-12', start: '2026-11-14T17:00:00+01:00', end: '2026-11-14T20:15:00+01:00' }, work_order: HERO }),
  'PATCH /bookings/BKG-58231-02': (r) =>
    r.body.resource_id
      ? { booking: booking({ id: 'BKG-58231-02', resource_id: 'IRD-11', ...SUN }), previous: { resource_id: 'IRD-07', start: '2026-11-14T17:00:00+01:00', end: '2026-11-14T20:15:00+01:00' }, work_order: HERO }
      : { status: 409, body: { error: { code: 'resource_busy', message: 'IRD-07 is not available Sun 15 Nov 19:45–23:00: held by WO-58240 (Serie A R12 – Napoli vs Lazio) Sun 15 Nov 20:30–22:30' } } },
});
const xytech = xytechClient(createApiClient({ system: 'Xytech', baseUrl: 'http://xytech.test/api/v1', token: 't', fetch: f, retries: 0 }));
let mcp: Awaited<ReturnType<typeof connect>>;
const last = () => f.calls.at(-1)!;

beforeAll(async () => { mcp = await connect((s) => register(s, { xytech })); });
afterAll(() => mcp.close());

describe('xytech MCP server', () => {
  it('exposes exactly the 4 read + 2 write tools from the PR plan', async () => {
    const names = (await mcp.tools()).map((t) => t.name).sort();
    expect(names).toEqual(['amend_booking', 'create_booking', 'get_availability', 'get_rates', 'list_bookings', 'list_resources']);
  });

  it('marks create_booking and amend_booking as writes that need ops approval', async () => {
    const writes = (await mcp.tools()).filter((t) => t.annotations?.readOnlyHint === false);
    expect(writes.map((t) => t.name).sort()).toEqual(['amend_booking', 'create_booking']);
    for (const t of writes) {
      expect(t.description).toContain('needs ops approval in chat');
      expect(t.annotations?.destructiveHint).toBe(false);
    }
  });

  it('has no delete, rate-change or cancel tools', async () => {
    expect((await mcp.tools()).some((t) => /delete|cancel|set_rate|update_rate/.test(t.name))).toBe(false);
  });

  it('list_resources passes the type filter', async () => {
    const r = await mcp.call('list_resources', { type: 'decoder' });
    expect(last().query.type).toBe('decoder');
    expect(r.text).toContain('IRD-11 · decoder');
  });

  it('get_availability sends the ids and window', async () => {
    await mcp.call('get_availability', { resource_ids: ['FIB-12', 'SAT-A', 'IRD-07', 'IRD-11'], ...SUN });
    expect(last().query).toEqual({ resource_ids: 'FIB-12,SAT-A,IRD-07,IRD-11', start: SUN.start, end: SUN.end });
  });

  it('get_availability reads like the Bookings Bot report (step B2′)', async () => {
    const r = await mcp.call('get_availability', { resource_ids: ['FIB-12', 'SAT-A', 'IRD-07', 'IRD-11'], ...SUN });
    expect(r.text).toContain('Availability Sun 15 Nov 19:45–23:00 CET:');
    expect(r.text).toContain('✅ FIB-12 free');
    expect(r.text).toContain('❌ IRD-07 busy: WO-58240 Serie A R12 – Napoli vs Lazio (Sun 15 Nov 20:30–22:30)');
    expect(r.text).toContain('✅ IRD-11 free');
  });

  it('list_bookings(date) lists one line per work order (step 2.11)', async () => {
    const r = await mcp.call('list_bookings', { date: '2026-11-15' });
    expect(last().query).toEqual({ date: '2026-11-15' });
    expect(r.text.split('\n')).toEqual([
      '2 work orders on Sun 15 Nov (CET):',
      "12:00–14:15 · WO-58244 Women's Serie A – Live · FIB-14, IRD-11 · Pending",
      '19:30–22:45 · WO-58240 Event B: Serie A R12 – Napoli vs Lazio · IRD-07 · Confirmed',
    ]);
  });

  it('list_bookings(work_order) shows booking ids and cost vs budget', async () => {
    const r = await mcp.call('list_bookings', { work_order: 'WO-58231' });
    expect(r.text).toContain('BKG-58231-02 · IRD-07 (main) · Sat 14 Nov 17:00–20:15 · £150');
    expect(r.text).toContain('Cost: £3,600 booked vs £4,000 budget (within budget)');
  });

  it('list_bookings needs a filter', async () => {
    const r = await mcp.call('list_bookings', {});
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Pass work_order, event_id or date');
  });

  it('get_rates shows the Sunday premium', async () => {
    const r = await mcp.call('get_rates', { resource_id: 'SAT-B', ...SUN });
    expect(r.text).toBe('SAT-B · Sun 15 Nov 19:45–23:00: £3,400 (Satellite SAT-B · Sunday premium, per event window)');
  });

  it('create_booking reports the approval, the released booking and the new cost (step D3)', async () => {
    const r = await mcp.call('create_booking', { work_order: 'WO-58231', resource_id: 'SAT-B', ...SUN, cost_approved_by: 'Ops user' });
    expect(last().body.cost_approved_by).toBe('Ops user');
    expect(r.text).toContain('Booked SAT-B for WO-58231 Sun 15 Nov 19:45–23:00 (backup) · £3,400 · approved by Ops user');
    expect(r.text).toContain('Released SAT-A');
    expect(r.text).toContain('+£750 over budget, approved by Ops user');
  });

  it('amend_booking moves FIB-12 and swaps IRD-07 → IRD-11 (steps D1, D2)', async () => {
    const fib = await mcp.call('amend_booking', { booking_id: 'BKG-58231-01', ...SUN });
    expect(fib.text).toMatch(/^Moved FIB-12 to Sun 15 Nov 19:45–23:00 for WO-58231/);
    const ird = await mcp.call('amend_booking', { booking_id: 'BKG-58231-02', ...SUN, resource_id: 'IRD-11' });
    expect(ird.text).toMatch(/^IRD-11 booked for WO-58231 Sun 15 Nov 19:45–23:00 \(BKG-58231-02, was IRD-07/);
  });

  it('amend_booking onto a busy resource is a tool error and changes nothing', async () => {
    const r = await mcp.call('amend_booking', { booking_id: 'BKG-58231-02', ...SUN });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Xytech API 409 resource_busy');
    expect(r.text).toContain('Nothing was changed.');
  });
});
