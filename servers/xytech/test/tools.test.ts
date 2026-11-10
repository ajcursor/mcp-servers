import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@dazn-ops/mcp-kit';
import { connect, fakeFetch } from '@dazn-ops/mcp-kit/testing';
import { xytechClient } from '../src/client.ts';
import { register } from '../src/index.ts';

const START = '2026-11-15T12:00:00+01:00';
const END = '2026-11-15T14:15:00+01:00';
const LATER_START = '2026-11-15T13:00:00+01:00';
const LATER_END = '2026-11-15T15:15:00+01:00';

const RESOURCES = [
  { id: 'FIB-14', name: 'Fibre 14', type: 'fibre', site: 'London' },
  { id: 'IRD-11', name: 'IRD 11', type: 'ird', site: 'London' },
];

const WO = {
  id: 'WO-58244',
  name: "Women's Serie A – Live",
  event_id: 'EVB',
  phase: 'Pending',
  start: START,
  end: END,
  resources: [
    { id: 'FIB-14', name: 'Fibre 14' },
    { id: 'IRD-11', name: 'IRD 11' },
  ],
};

const f = fakeFetch({
  'GET /resources': (req) => ({
    resources: req.query.type ? RESOURCES.filter((r) => r.type === req.query.type) : RESOURCES,
  }),
  'GET /availability': () => ({
    availability: [
      { resource_id: 'FIB-14', name: 'Fibre 14', state: 'free' },
      {
        resource_id: 'IRD-11',
        name: 'IRD 11',
        state: 'busy',
        bookings: [{ work_order: 'WO-58244', start: START, end: END }],
      },
      { resource_id: 'STUD-2', name: 'Studio 2', state: 'warning', note: 'maintenance window' },
    ],
  }),
  'GET /bookings': () => ({
    bookings: [
      { id: 'BK-1', work_order: 'WO-58244', name: "Women's Serie A – Live", resource_id: 'FIB-14', start: START, end: END, phase: 'Pending' },
      { id: 'BK-2', work_order: 'WO-58244', name: "Women's Serie A – Live", resource_id: 'IRD-11', start: START, end: END, phase: 'Pending' },
    ],
  }),
  'GET /work-orders/:id': () => WO,
  'GET /work-orders': () => ({ work_orders: [WO] }),
  'GET /rates': () => ({ resource_id: 'FIB-14', name: 'Fibre 14', start: START, end: END, total_gbp: 4750 }),
  'POST /bookings': (req) => {
    if (req.body?.work_order === 'WO-BUSY') return { status: 409, body: { error: { code: 'conflict', message: 'FIB-14 is busy' } } };
    return {
      booking: {
        id: 'BK-1001',
        work_order: 'WO-58244',
        name: "Women's Serie A – Live",
        resource_id: 'FIB-14',
        resource_name: 'Fibre 14',
        start: START,
        end: END,
        rate_gbp: 4750,
      },
    };
  },
  'PATCH /bookings/:id': () => ({
    booking: {
      id: 'BK-1001',
      work_order: 'WO-58244',
      resource_id: 'FIB-14',
      resource_name: 'Fibre 14',
      start: LATER_START,
      end: LATER_END,
    },
  }),
});

const xytech = xytechClient(createApiClient({ system: 'Xytech', baseUrl: 'http://xytech.test/api/v1', token: 't', fetch: f, retries: 0 }));
let mcp: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => { mcp = await connect((s) => register(s, { xytech })); });
afterAll(() => mcp.close());

describe('xytech MCP server', () => {
  it('lists the six tools, annotates writes, and has no delete, cancel, or rate change', async () => {
    const tools = await mcp.tools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'amend_booking',
      'create_booking',
      'get_availability',
      'get_rates',
      'list_bookings',
      'list_resources',
    ]);
    for (const name of ['create_booking', 'amend_booking']) {
      const t = tools.find((tool) => tool.name === name);
      expect(t?.annotations?.readOnlyHint).toBe(false);
      expect(t?.description).toContain('needs ops approval in chat');
    }
    expect(tools.find((t) => t.name === 'list_resources')?.annotations?.readOnlyHint).toBe(true);
    for (const t of tools) expect(t.name).not.toMatch(/delete|cancel|rate.?change/i);
  });

  it('list_resources names both London resources', async () => {
    const r = await mcp.call('list_resources');
    expect(r.text).toContain('2 resources:');
    expect(r.text).toContain('FIB-14 Fibre 14 · fibre · London');
    expect(r.text).toContain('IRD-11 IRD 11 · ird · London');
  });

  it('list_resources filters by type and asks the API for that type', async () => {
    const r = await mcp.call('list_resources', { type: 'fibre' });
    expect(r.text).toContain('1 fibre resource:');
    expect(r.text).toContain('FIB-14 Fibre 14 · London');
    expect(r.text).not.toContain('IRD-11');
    expect(f.calls.filter((c) => c.path === '/resources').at(-1)?.query.type).toBe('fibre');
  });

  it('list_resources with an unknown type reports none', async () => {
    const r = await mcp.call('list_resources', { type: 'camera' });
    expect(r.isError).toBe(false);
    expect(r.text).not.toContain('FIB-14');
    expect(r.text).not.toContain('IRD-11');
    expect(r.text).toBe('No camera resources.');
    expect(f.calls.filter((c) => c.path === '/resources').at(-1)?.query.type).toBe('camera');
  });

  it('get_availability marks free, busy and warning in the window', async () => {
    const r = await mcp.call('get_availability', { resource_ids: ['FIB-14', 'IRD-11', 'STUD-2'], start: START, end: END });
    expect(r.text).toContain('Sun 15 Nov 12:00–14:15:');
    expect(r.text).toContain('✅ FIB-14 Fibre 14 is free');
    expect(r.text).toContain('❌ IRD-11 IRD 11 is busy · WO-58244 12:00–14:15');
    expect(r.text).toContain('⚠️ STUD-2 Studio 2 · maintenance window');
    expect(f.calls.filter((c) => c.path === '/availability').at(-1)?.query.resource_ids).toBe('FIB-14,IRD-11,STUD-2');
  });

  it('list_bookings by date is one line per work order', async () => {
    const r = await mcp.call('list_bookings', { date: '2026-11-15' });
    expect(r.text).toContain('1 work order on Sun 15 Nov (CET):');
    expect(r.text).toContain("• 12:00–14:15 · WO-58244 Women's Serie A – Live · FIB-14, IRD-11 · Pending");
  });

  it('list_bookings by work order names the event and resources', async () => {
    const r = await mcp.call('list_bookings', { work_order: 'WO-58244' });
    expect(r.text).toContain("WO-58244 Women's Serie A – Live (EVB) · Pending");
    expect(r.text).toContain('Sun 15 Nov 12:00–14:15 · FIB-14 Fibre 14, IRD-11 IRD 11');
  });

  it('list_bookings by event id lists that event’s work orders', async () => {
    const r = await mcp.call('list_bookings', { event_id: 'EVB' });
    expect(r.text).toContain('1 work order for EVB:');
    expect(r.text).toContain('WO-58244');
  });

  it('list_bookings with no selector is a tool error', async () => {
    const r = await mcp.call('list_bookings', {});
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Pass work_order, event_id or date');
  });

  it('get_rates prices the fibre window', async () => {
    const r = await mcp.call('get_rates', { resource_id: 'FIB-14', start: START, end: END });
    expect(r.text).toContain('FIB-14 Fibre 14 · Sun 15 Nov 12:00–14:15 · £4,750');
  });

  it('create_booking books the fibre and sends the approved cost', async () => {
    const r = await mcp.call('create_booking', {
      work_order: 'WO-58244',
      resource_id: 'FIB-14',
      start: START,
      end: END,
      role: 'primary',
      cost_approved_by: 'Alex',
    });
    expect(r.text).toContain('Booked FIB-14 Fibre 14 on WO-58244');
    expect(r.text).toContain('£4,750');
    expect(r.text).toContain('BK-1001');
    const recorded = f.calls.filter((c) => c.method === 'POST' && c.path === '/bookings' && c.body?.work_order === 'WO-58244').at(-1);
    expect(recorded?.body).toEqual({
      work_order: 'WO-58244',
      resource_id: 'FIB-14',
      start: START,
      end: END,
      role: 'primary',
      cost_approved_by: 'Alex',
    });
  });

  it('amend_booking moves the window and patches only start and end', async () => {
    const r = await mcp.call('amend_booking', { booking_id: 'BK-1001', start: LATER_START, end: LATER_END });
    expect(r.text).toContain('Amended BK-1001');
    expect(r.text).toContain('Sun 15 Nov 13:00–15:15');
    expect(r.text).toContain('FIB-14 Fibre 14');
    const recorded = f.calls.filter((c) => c.method === 'PATCH' && c.path === '/bookings/BK-1001').at(-1);
    expect(recorded?.body).toEqual({ start: LATER_START, end: LATER_END });
  });

  it('create_booking on a busy resource is a tool error and changes nothing', async () => {
    const r = await mcp.call('create_booking', {
      work_order: 'WO-BUSY',
      resource_id: 'FIB-14',
      start: START,
      end: END,
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Xytech API 409');
    expect(r.text).toContain('Nothing was changed');
  });
});
