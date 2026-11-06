import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@dazn-ops/mcp-kit';
import { connect, fakeFetch } from '@dazn-ops/mcp-kit/testing';
import { dataminerClient } from '../src/client.ts';
import { register } from '../src/index.ts';

const IRD11 = {
  id: 'IRD-11', type: 'Satellite decoder', location: 'MCR Rack 3', model: 'Ericsson RX8200', status: 'Normal',
  params: { 'Input lock': 'Locked', Temperature: '41°C' },
  bookings: [{ job_id: 'JOB-B0407', name: 'Bundesliga', start: '2026-11-14T14:15:00+01:00', end: '2026-11-14T17:15:00+01:00', label: 'Sat 14 Nov 14:15–17:15' }],
  alarms: [],
};
const ALARM = { id: 'ALM-3107', severity: 'Warning', element: 'IRD-07', description: 'Resource conflict: booked for Napoli vs Lazio (Event B) Sun 20:30–22:30', state: 'Open', raised_at: '2026-11-13T14:05:00+01:00', time: '14:05:00', raised_by: 'MCR Bot' };
const MOVED = { id: 'JOB-M1207', name: 'Serie A R12 – Juventus vs Inter', start: '2026-11-15T19:45:00+01:00', end: '2026-11-15T23:00:00+01:00', label: 'Sun 15 Nov 19:45–23:00', status: 'Upcoming', booking: 'Confirmed', resources: [{ id: 'FIB-12', status: 'Normal' }, { id: 'IRD-11', status: 'Normal' }], pre_roll_min: 60, resource_conflicts: [] };

const f = fakeFetch({
  'GET /elements/IRD-11': () => IRD11,
  'POST /alarms': (r) => ({ status: 201, body: { alarm: { ...ALARM, ...r.body } } }),
  'GET /alarms': () => ({ alarms: [ALARM] }),
  'POST /alarms/ALM-3107/clear': () => ({ alarm: { ...ALARM, state: 'Cleared' } }),
  'POST /jobs/JOB-M1207/move': () => ({ job: MOVED, previous: { start: '2026-11-14T17:00:00+01:00', end: '2026-11-14T20:15:00+01:00', resources: ['FIB-12', 'IRD-07'] }, warnings: [] }),
});
const dataminer = dataminerClient(createApiClient({ system: 'DataMiner', baseUrl: 'http://dm.test/api/v1', token: 't', fetch: f, retries: 0 }));
let mcp: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => { mcp = await connect((s) => register(s, { dataminer })); });
afterAll(() => mcp.close());

describe('dataminer MCP server', () => {
  it('exposes get_resource_health, list_jobs, move_job, raise_alarm, clear_alarm', async () => {
    const tools = await mcp.tools();
    expect(tools.map((t) => t.name).sort()).toEqual(['clear_alarm', 'get_resource_health', 'list_jobs', 'move_job', 'raise_alarm']);
    expect(tools.filter((t) => t.annotations?.readOnlyHint === false).map((t) => t.name).sort()).toEqual(['clear_alarm', 'move_job', 'raise_alarm']);
  });

  it('get_resource_health says IRD-11 is healthy and free in the window (step B3′)', async () => {
    const r = await mcp.call('get_resource_health', { element_id: 'IRD-11', start: '2026-11-15T19:45:00+01:00', end: '2026-11-15T23:00:00+01:00' });
    expect(r.text).toContain('IRD-11 (Satellite decoder, MCR Rack 3): ✅ healthy');
    expect(r.text).toContain('No DataMiner jobs on IRD-11 Sun 15 Nov 19:45–23:00');
  });

  it('raise_alarm defaults to an amber Warning', async () => {
    const r = await mcp.call('raise_alarm', { element: 'IRD-07', description: ALARM.description });
    expect(f.calls.at(-1)?.body.severity).toBe('Warning');
    expect(r.text).toContain('Warning alarm ALM-3107 (amber) on IRD-07');
  });

  it('move_job reports the new window, resources and released decoder (step D5)', async () => {
    const r = await mcp.call('move_job', { job_id: 'JOB-M1207', start: MOVED.start, end: MOVED.end, resources: ['FIB-12', 'IRD-11'] });
    expect(r.text).toContain('Event job moved: JOB-M1207');
    expect(r.text).toContain('Sun 15 Nov 19:45–23:00 CET on FIB-12, IRD-11');
    expect(r.text).toContain('released IRD-07');
  });

  it('clear_alarm finds the open alarm by element (step D6)', async () => {
    const r = await mcp.call('clear_alarm', { element: 'IRD-07' });
    expect(r.text).toBe('IRD-07 alarm cleared (ALM-3107: Resource conflict: booked for Napoli vs Lazio (Event B) Sun 20:30–22:30).');
  });
});
