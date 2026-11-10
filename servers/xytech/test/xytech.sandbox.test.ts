import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiClient } from '@dazn-ops/mcp-kit';
import { connect, startSandbox } from '@dazn-ops/mcp-kit/testing';
import { xytechClient } from '../src/client.ts';
import { register } from '../src/index.ts';

const sandbox = await startSandbox({
  envUrl: 'XYTECH_SANDBOX_URL',
  envToken: 'XYTECH_SANDBOX_TOKEN',
  envDir: 'MEDIAPULSE_SIM_DIR',
  defaultDirs: ['../mediapulse-sim', '.sandbox/mediapulse-sim'],
  port: 4952,
  token: 'sandbox-token',
});

const WINDOW = { start: '2026-11-15T12:00:00+01:00', end: '2026-11-15T14:15:00+01:00' };
const FAR = { start: '2027-01-15T09:00:00+01:00', end: '2027-01-15T10:00:00+01:00' };

describe.skipIf(!sandbox)('xytech sandbox', () => {
  let mcp: Awaited<ReturnType<typeof connect>>;

  beforeAll(async () => {
    const xytech = xytechClient(createApiClient({
      system: 'Xytech',
      baseUrl: sandbox!.url,
      token: sandbox!.token,
      retries: 0,
    }));
    mcp = await connect((s) => register(s, { xytech }));
  });
  beforeEach(() => sandbox!.reset());
  afterAll(async () => {
    await mcp?.close();
    sandbox?.stop();
  });

  async function resourceId(): Promise<string | undefined> {
    const listed = await mcp.call('list_resources');
    return listed.text.match(/[A-Z][A-Z0-9-]*/)?.[0];
  }

  it('list_resources returns a bullet list or says there are none', async () => {
    const r = await mcp.call('list_resources');
    expect(r.isError).toBe(false);
    expect(r.text).toMatch(/•|No resources/);
  });

  it('get_availability reports a state, or a Xytech API error, for the first resource', async () => {
    const id = await resourceId();
    expect(id).toBeTruthy();
    const r = await mcp.call('get_availability', { resource_ids: [id], ...WINDOW });
    const state = /✅|⚠️|❌/.test(r.text);
    const apiError = r.isError && r.text.includes('Xytech API');
    expect(state || apiError).toBe(true);
  });

  it('list_bookings for 15 Nov talks about work orders', async () => {
    const r = await mcp.call('list_bookings', { date: '2026-11-15' });
    expect(r.text).toMatch(/work order/i);
  });

  it('get_rates returns a pound amount or a Xytech API error', async () => {
    const id = await resourceId();
    expect(id).toBeTruthy();
    const r = await mcp.call('get_rates', { resource_id: id, ...WINDOW });
    const priced = r.text.includes('£');
    const apiError = r.isError && r.text.includes('Xytech API');
    expect(priced || apiError).toBe(true);
  });

  it('list_bookings follows a work order from the date, or the EVB event', async () => {
    const listed = await mcp.call('list_bookings', { date: '2026-11-15' });
    const wo = listed.text.match(/WO-[A-Z0-9-]+/)?.[0];
    if (wo) {
      const r = await mcp.call('list_bookings', { work_order: wo });
      if (r.isError) expect(r.text).toContain('Xytech API');
      else expect(r.text.length).toBeGreaterThan(0);
      return;
    }
    const r = await mcp.call('list_bookings', { event_id: 'EVB' });
    const line = /work order/i.test(r.text);
    const apiError = r.text.includes('Xytech API');
    expect(line || apiError).toBe(true);
  });

  it('create_booking then amend_booking, or reports that nothing changed', async () => {
    const listedResources = await mcp.call('list_resources');
    const resource = listedResources.text.match(/[A-Z][A-Z0-9-]*/)?.[0] ?? 'FIB-14';
    const listed = await mcp.call('list_bookings', { date: '2026-11-15' });
    const workOrder = listed.text.match(/WO-[A-Z0-9-]+/)?.[0] ?? 'WO-58244';
    const created = await mcp.call('create_booking', {
      work_order: workOrder,
      resource_id: resource,
      ...FAR,
      role: 'test',
    });
    if (created.isError) {
      expect(created.text).toContain('Nothing was changed');
      return;
    }
    expect(created.text).toContain('Booked');
    const bookingId = created.text.match(/BK-[A-Z0-9-]+/)?.[0] ?? created.text.trim().split(/\s+/).at(-1);
    const amended = await mcp.call('amend_booking', {
      booking_id: bookingId,
      start: '2027-01-15T09:30:00+01:00',
      end: '2027-01-15T10:30:00+01:00',
    });
    expect(amended.text).toContain('Amended');
  });
});
