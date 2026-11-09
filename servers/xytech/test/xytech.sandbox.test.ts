import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { connect, startSandbox } from '@dazn-ops/mcp-kit/testing';
import { clientFromEnv } from '../src/client.ts';
import { register } from '../src/index.ts';

const sandbox = await startSandbox({
  envUrl: 'XYTECH_SANDBOX_URL',
  envToken: 'XYTECH_SANDBOX_TOKEN',
  envDir: 'MEDIAPULSE_SIM_DIR',
  defaultDirs: ['../mediapulse-sim', '.sandbox/mediapulse-sim'],
  port: 4952,
  token: 'sandbox-token',
});

const START = '2026-11-15T12:00:00+01:00';
const END = '2026-11-15T14:15:00+01:00';

describe.skipIf(!sandbox)('xytech sandbox', () => {
  let mcp: Awaited<ReturnType<typeof connect>> | undefined;

  beforeEach(async () => {
    await sandbox!.reset();
    process.env.XYTECH_API_URL = sandbox!.url;
    process.env.XYTECH_API_TOKEN = sandbox!.token;
    mcp = await connect((s) => register(s, { xytech: clientFromEnv() }));
  });

  afterEach(async () => {
    const current = mcp;
    mcp = undefined;
    await current?.close();
  });

  afterAll(() => {
    sandbox?.stop();
  });

  it('lists resources', async () => {
    const r = await mcp!.call('list_resources');
    expect(r.isError).toBe(false);
    expect(r.text).toMatch(/[A-Z]{2,}-\d+|No resources/);
  });

  it('checks availability for a listed resource', async () => {
    const listed = await mcp!.call('list_resources');
    expect(listed.isError).toBe(false);
    const id = listed.text.match(/[A-Z]{2,}-\d+/)?.[0];
    if (!id) {
      expect(listed.text).toContain('No resources');
      return;
    }
    const r = await mcp!.call('get_availability', { resource_ids: [id], start: START, end: END });
    expect(r.isError).toBe(false);
    expect(r.text.includes(id) || r.text.includes('No availability')).toBe(true);
  });

  it('lists work orders on Sun 15 Nov', async () => {
    const r = await mcp!.call('list_bookings', { date: '2026-11-15' });
    expect(r.isError).toBe(false);
    expect(r.text).toMatch(/work orders? on Sun 15 Nov/);
  });

  it('quotes a rate, or a vendor error when the sandbox has none', async () => {
    const listed = await mcp!.call('list_resources');
    const id = listed.text.match(/[A-Z]{2,}-\d+/)?.[0];
    if (!id) {
      expect(listed.isError).toBe(false);
      expect(listed.text).toContain('No resources');
      return;
    }
    const r = await mcp!.call('get_rates', { resource_id: id, start: START, end: END });
    if (r.isError) expect(r.text).toContain('Xytech API');
    else expect(r.text).toContain('£');
  });

  it('creates and amends a booking when the day has a work order', async () => {
    const listed = await mcp!.call('list_resources');
    const resourceId = listed.text.match(/[A-Z]{2,}-\d+/)?.[0];
    const day = await mcp!.call('list_bookings', { date: '2026-11-15' });
    const workOrder = day.text.match(/WO-\d+/)?.[0];
    if (!workOrder || !resourceId) {
      expect(day.isError).toBe(false);
      return;
    }
    const created = await mcp!.call('create_booking', {
      work_order: workOrder,
      resource_id: resourceId,
      start: START,
      end: END,
    });
    if (created.isError) {
      expect(created.text).toContain('Xytech API');
      expect(created.text).toContain('Nothing was changed.');
      return;
    }
    expect(created.text).toContain('Booked');
    expect(created.text).toContain('Booking');
    const bookingId = created.text.match(/Booking\s+([A-Z]+-\d+)/)?.[1];
    expect(bookingId).toBeTruthy();
    const amended = await mcp!.call('amend_booking', { booking_id: bookingId!, end: '2026-11-15T15:00:00+01:00' });
    expect(amended.isError).toBe(false);
    expect(amended.text).toMatch(/Amended|No change/);
  });

  it('reads a work order from the day, or the vendor error', async () => {
    const day = await mcp!.call('list_bookings', { date: '2026-11-15' });
    const workOrder = day.text.match(/WO-\d+/)?.[0] ?? 'WO-58244';
    const r = await mcp!.call('list_bookings', { work_order: workOrder });
    expect(r.isError === false || r.text.includes('Xytech API')).toBe(true);
  });
});
