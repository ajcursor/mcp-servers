import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@dazn-ops/mcp-kit';
import { connect, fakeFetch } from '@dazn-ops/mcp-kit/testing';
import { xytechClient } from '../src/client.ts';
import { register } from '../src/index.ts';

const FIBRE = { id: 'FIB-14', name: 'Fibre path 14', type: 'fibre', site: 'London' };
const IRD = { id: 'IRD-11', name: 'IRD 11', type: 'ird', site: 'London' };
const WO = {
  id: 'WO-58244',
  name: "Women's Serie A – Live",
  event_id: 'EVB',
  start: '2026-11-15T12:00:00+01:00',
  end: '2026-11-15T14:15:00+01:00',
  phase: 'Pending',
  resources: [
    { id: 'FIB-14', name: 'Fibre path 14' },
    { id: 'IRD-11', name: 'IRD 11' },
  ],
};
const BOOKING = {
  id: 'BK-9001',
  work_order: 'WO-58244',
  work_order_name: "Women's Serie A – Live",
  resource_id: 'FIB-14',
  resource_name: 'Fibre path 14',
  role: 'TX',
  start: WO.start,
  end: WO.end,
  phase: 'Pending',
  rate: 4750,
  cost_approved_by: 'Ally Jarrett',
};

const f = fakeFetch({
  'GET /resources': (r) => ({ resources: r.query.type === 'fibre' ? [FIBRE] : r.query.type === 'none' ? [] : [IRD, FIBRE] }),
  'GET /availability': () => ({
    availability: [
      { resource_id: 'FIB-14', name: 'Fibre path 14', status: 'free' },
      { resource_id: 'IRD-11', name: 'IRD 11', status: 'warning', note: 'maintenance window' },
      {
        resource_id: 'CAM-3',
        name: 'Camera 3',
        status: 'busy',
        booking: { work_order: 'WO-58244', name: "Women's Serie A – Live", start: WO.start, end: WO.end },
      },
    ],
  }),
  'GET /work-orders/WO-58244': () => WO,
  'GET /work-orders/WO-MISSING': () => ({ status: 404, body: { error: { code: 'not_found', message: 'No such work order' } } }),
  'GET /work-orders': (r) => ({ work_orders: r.query.event_id === 'EVB' ? [WO] : [] }),
  'GET /bookings': (r) => {
    if (r.query.date === '2026-11-15') return { work_orders: [WO] };
    if (r.query.date === '2026-11-17') {
      return {
        bookings: [
          {
            id: 'BK-1',
            work_order: 'WO-58244',
            work_order_name: "Women's Serie A – Live",
            resource_id: 'FIB-14',
            resource_name: 'Fibre path 14',
            start: '2026-11-17T12:00:00+01:00',
            end: '2026-11-17T14:15:00+01:00',
            phase: 'Pending',
          },
          {
            id: 'BK-2',
            work_order: 'WO-58244',
            work_order_name: "Women's Serie A – Live",
            resource_id: 'IRD-11',
            resource_name: 'IRD 11',
            start: '2026-11-17T12:00:00+01:00',
            end: '2026-11-17T16:00:00+01:00',
            phase: 'Pending',
          },
        ],
      };
    }
    return { work_orders: [] };
  },
  'GET /rates': () => ({
    resource_id: 'FIB-14',
    name: 'Fibre path 14',
    start: WO.start,
    end: WO.end,
    total: 4750,
    currency: 'GBP',
    breakdown: [
      { label: 'Fibre hire', amount: 4000 },
      { label: 'Setup', amount: 750 },
    ],
  }),
  'POST /bookings': (r) =>
    r.body.resource_id === 'BUSY'
      ? { status: 409, body: { error: { code: 'conflict', message: 'FIB-14 is busy' } } }
      : {
          status: 201,
          body: {
            booking: {
              ...BOOKING,
              ...r.body,
              resource_name: 'Fibre path 14',
              work_order_name: "Women's Serie A – Live",
              id: 'BK-9001',
              phase: 'Pending',
              rate: 4750,
            },
          },
        },
  'PATCH /bookings/BK-9001': (r) => ({
    booking: { ...BOOKING, ...r.body, end: r.body.end ?? BOOKING.end },
    changed: Object.keys(r.body),
  }),
  'PATCH /bookings/BK-SAME': () => ({ booking: BOOKING, changed: [] }),
});

const xytech = xytechClient(
  createApiClient({ system: 'Xytech', baseUrl: 'http://xytech.test/api/v1', token: 't', fetch: f, retries: 0 }),
);
let mcp: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => {
  mcp = await connect((s) => register(s, { xytech }));
});
afterAll(() => mcp.close());

describe('xytech MCP server', () => {
  it('exposes the six tools, with write tools annotated', async () => {
    const tools = await mcp.tools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'amend_booking',
      'create_booking',
      'get_availability',
      'get_rates',
      'list_bookings',
      'list_resources',
    ]);
    for (const name of ['amend_booking', 'create_booking']) {
      const t = tools.find((tool) => tool.name === name);
      expect(t?.annotations?.readOnlyHint).toBe(false);
      expect(t?.description).toContain('needs ops approval in chat');
    }
    expect(tools.find((t) => t.name === 'list_resources')?.annotations?.readOnlyHint).toBe(true);
  });

  it('lists resources sorted by id, with type and site', async () => {
    const r = await mcp.call('list_resources');
    expect(r.isError).toBe(false);
    expect(r.text).toContain('2 resources:');
    expect(r.text).toContain('FIB-14 Fibre path 14 · fibre · London');
    expect(r.text).toContain('IRD-11 IRD 11 · ird · London');
    expect(r.text.indexOf('FIB-14')).toBeGreaterThanOrEqual(0);
    expect(r.text.indexOf('FIB-14')).toBeLessThan(r.text.indexOf('IRD-11'));
  });

  it('lists one type without repeating the type on each line', async () => {
    const r = await mcp.call('list_resources', { type: 'fibre' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('1 resource (fibre):');
    expect(r.text).toContain('FIB-14 Fibre path 14 · London');
    expect(r.text).toContain('• FIB-14 Fibre path 14 · London');
    expect(r.text).not.toContain('· fibre');
  });

  it('says when a type has no resources', async () => {
    const r = await mcp.call('list_resources', { type: 'none' });
    expect(r.isError).toBe(false);
    expect(r.text).toBe('No resources of type none.');
  });

  it('shows free, warning and busy for the window', async () => {
    const r = await mcp.call('get_availability', {
      resource_ids: ['FIB-14', 'IRD-11', 'CAM-3'],
      start: WO.start,
      end: WO.end,
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('3 resources · Sun 15 Nov 12:00–14:15 CET:');
    expect(r.text).toContain('✅ FIB-14 Fibre path 14 · free');
    expect(r.text).toContain('⚠️ IRD-11 IRD 11 · maintenance window');
    expect(r.text).toContain("❌ CAM-3 Camera 3 · WO-58244 Women's Serie A – Live 12:00–14:15");
  });

  it('lists work orders on a date, one line each', async () => {
    const r = await mcp.call('list_bookings', { date: '2026-11-15' });
    expect(r.isError).toBe(false);
    expect(r.text).toBe(
      "1 work order on Sun 15 Nov (CET):\n• 12:00–14:15 · WO-58244 Women's Serie A – Live · FIB-14, IRD-11 · Pending",
    );
  });

  it('groups a date of booking rows into one line per work order', async () => {
    const r = await mcp.call('list_bookings', { date: '2026-11-17' });
    expect(r.isError).toBe(false);
    expect(r.text).toBe(
      "1 work order on Tue 17 Nov (CET):\n• 12:00–16:00 · WO-58244 Women's Serie A – Live · FIB-14, IRD-11 · Pending",
    );
  });

  it('says when a date has no work orders', async () => {
    const r = await mcp.call('list_bookings', { date: '2026-11-16' });
    expect(r.isError).toBe(false);
    expect(r.text).toBe('No work orders on Mon 16 Nov.');
  });

  it('reads one work order with its resources and event', async () => {
    const r = await mcp.call('list_bookings', { work_order: 'WO-58244' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("WO-58244 Women's Serie A – Live · Sun 15 Nov 12:00–14:15 CET · Pending");
    expect(r.text).toContain('Resources: FIB-14 Fibre path 14, IRD-11 IRD 11');
    expect(r.text).toContain('Event: EVB');
  });

  it('lists work orders for an event', async () => {
    const r = await mcp.call('list_bookings', { event_id: 'EVB' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('1 work order for EVB:');
    expect(r.text).toContain('• Sun 15 Nov 12:00–14:15 · WO-58244');
  });

  it('says when an event has no work orders', async () => {
    const r = await mcp.call('list_bookings', { event_id: 'NONE' });
    expect(r.isError).toBe(false);
    expect(r.text).toBe('No work orders for NONE.');
  });

  it('rejects list_bookings with no selector', async () => {
    const r = await mcp.call('list_bookings');
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Pass exactly one of work_order, event_id or date.');
  });

  it('rejects list_bookings with two selectors', async () => {
    const r = await mcp.call('list_bookings', { date: '2026-11-15', work_order: 'WO-58244' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Pass exactly one of work_order, event_id or date.');
  });

  it('quotes a rate with its breakdown', async () => {
    const r = await mcp.call('get_rates', { resource_id: 'FIB-14', start: WO.start, end: WO.end });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("FIB-14 Fibre path 14 · Sun 15 Nov 12:00–14:15 CET · £4,750");
    expect(r.text).toContain('• Fibre hire £4,000');
    expect(r.text).toContain('• Setup £750');
  });

  it('creates a booking and sends the approved cost', async () => {
    const before = f.calls.length;
    const r = await mcp.call('create_booking', {
      work_order: 'WO-58244',
      resource_id: 'FIB-14',
      start: WO.start,
      end: WO.end,
      role: 'TX',
      cost_approved_by: 'Ally Jarrett',
    });
    const body = f.calls.slice(before).find((c) => c.method === 'POST' && c.path === '/bookings')?.body;
    expect(body).toEqual({
      work_order: 'WO-58244',
      resource_id: 'FIB-14',
      start: WO.start,
      end: WO.end,
      role: 'TX',
      cost_approved_by: 'Ally Jarrett',
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Booked FIB-14 Fibre path 14 on WO-58244 Women's Serie A – Live");
    expect(r.text).toContain('Sun 15 Nov 12:00–14:15 CET · Pending · £4,750');
    expect(r.text).toContain('Booking BK-9001 · TX · cost approved by Ally Jarrett.');
  });

  it('returns a conflict as a tool error and says nothing changed', async () => {
    const r = await mcp.call('create_booking', {
      work_order: 'WO-58244',
      resource_id: 'BUSY',
      start: WO.start,
      end: WO.end,
    });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Xytech API 409');
    expect(r.text).toContain('Nothing was changed.');
  });

  it('returns a missing work order as a read error', async () => {
    const r = await mcp.call('list_bookings', { work_order: 'WO-MISSING' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Xytech API 404');
    expect(r.text).not.toContain('Nothing was changed');
  });

  it('amends a booking and names the fields that changed', async () => {
    const r = await mcp.call('amend_booking', { booking_id: 'BK-9001', end: '2026-11-15T15:00:00+01:00' });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('Amended booking BK-9001 on WO-58244');
    expect(r.text).toContain('Changed: end.');
  });

  it('reports a no-op amend', async () => {
    const r = await mcp.call('amend_booking', { booking_id: 'BK-SAME', start: WO.start });
    expect(r.isError).toBe(false);
    expect(r.text).toBe('No change: booking BK-9001 already matches.');
  });

  it('rejects an amend with nothing to change', async () => {
    const r = await mcp.call('amend_booking', { booking_id: 'BK-9001' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Pass start, end, resource_id or cost_approved_by.');
  });
});
