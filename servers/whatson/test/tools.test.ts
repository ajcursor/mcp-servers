import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@dazn-ops/mcp-kit';
import { connect, fakeFetch } from '@dazn-ops/mcp-kit/testing';
import { whatsonClient } from '../src/client.ts';
import { register } from '../src/index.ts';
import type { Fixture } from '../src/schemas.ts';

const fixture = (over: Partial<Fixture>): Fixture => ({
  id: 'M-1207', match: 'Juventus vs Inter', competition: 'Serie A 2026/27', round: 12, venue: 'Allianz Stadium',
  kickoff: '2026-11-14T18:00:00+01:00', end: '2026-11-14T20:00:00+01:00', duration_min: 120,
  territories: ['IT', 'ES', 'DE', 'JP'], channel: 'Italy Events Channel',
  services: [{ type: 'ott', name: 'DAZN app', territories: ['IT', 'ES', 'DE', 'JP'] }, { type: 'linear', name: 'Italy Events Channel', territories: ['IT'] }],
  status: 'confirmed', listing_state: 'published', channel_clash: null, ...over,
});
const M1207 = fixture({});
const EVB = fixture({ id: 'EVB', match: 'Napoli vs Lazio', kickoff: '2026-11-15T20:30:00+01:00', end: '2026-11-15T22:30:00+01:00', territories: ['IT'] });
const EVB_CLASH = { event_id: 'EVB', match: 'Napoli vs Lazio', channel: 'Italy Events Channel', start: EVB.kickoff, end: EVB.end, overlap_min: 105 };

const f = fakeFetch({
  'GET /fixtures/M-1207': () => M1207,
  'GET /fixtures/EVB': () => EVB,
  'GET /fixtures': (r) => ({ fixtures: r.query.channel ? [fixture({ id: 'M-1207', kickoff: '2026-11-15T20:45:00+01:00', end: '2026-11-15T22:45:00+01:00' })] : [M1207, EVB] }),
  'POST /fixtures/M-1207/clash-check': (r) => ({
    fixture_id: 'M-1207', match: 'Juventus vs Inter', channel: 'Italy Events Channel',
    window: { start: r.body.kickoff ?? M1207.kickoff, end: r.body.kickoff ? '2026-11-15T22:45:00+01:00' : M1207.end, label: '' },
    clash: !!r.body.kickoff, clashes: r.body.kickoff ? [EVB_CLASH] : [],
  }),
  'PATCH /fixtures/EVB': (r) => ({ fixture: { ...EVB, channel: r.body.channel, status: 'changed', listing_state: 'unpublished' }, changed: ['channel'] }),
  'PATCH /fixtures/M-1201': () => ({ status: 409, body: { error: { code: 'conflict', message: 'nope' } } }),
  'POST /listings/publish': (r) => ({ published: r.body.event_ids, fixtures: [fixture({ kickoff: '2026-11-15T20:45:00+01:00' }), { ...EVB, channel: 'DAZN app only' }] }),
});
const whatson = whatsonClient(createApiClient({ system: "What'sOn", baseUrl: 'http://whatson.test/api/v1', token: 't', fetch: f, retries: 0 }));
let mcp: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => { mcp = await connect((s) => register(s, { whatson })); });
afterAll(() => mcp.close());

describe('whatson MCP server', () => {
  it('exposes the six tools, with write tools annotated', async () => {
    const tools = await mcp.tools();
    expect(tools.map((t) => t.name).sort()).toEqual(['check_channel_clash', 'get_fixture', 'list_fixtures', 'publish_listings', 'set_channel', 'update_fixture']);
    for (const t of tools.filter((t) => ['update_fixture', 'set_channel', 'publish_listings'].includes(t.name))) {
      expect(t.annotations?.readOnlyHint).toBe(false);
      expect(t.description).toContain('needs ops approval in chat');
    }
    expect(tools.find((t) => t.name === 'get_fixture')?.annotations?.readOnlyHint).toBe(true);
  });

  it('get_fixture reads like the walkthrough (step 1.3)', async () => {
    const r = await mcp.call('get_fixture', { fixture_id: 'M-1207' });
    expect(r.text).toContain('Juventus vs Inter');
    expect(r.text).toContain('Sat 14 Nov 18:00 CET');
    expect(r.text).toContain('DAZN app in IT, ES, DE, JP · Italy Events Channel');
  });

  it('check_channel_clash names EVB, 20:30–22:30 and 105 min (step 1.4)', async () => {
    const r = await mcp.call('check_channel_clash', { fixture_id: 'M-1207', kickoff: '2026-11-15T20:45:00+01:00' });
    expect(r.text).toContain('⚠️ Clash on the Italy Events Channel');
    expect(r.text).toContain('Napoli vs Lazio (EVB) 20:30–22:30, 105 min overlap');
    expect(r.text).toContain('app-only in Italy');
  });

  it('check_channel_clash reports a clear slot', async () => {
    const r = await mcp.call('check_channel_clash', { fixture_id: 'M-1207' });
    expect(r.text).toMatch(/^✅ No clash/);
  });

  it('set_channel accepts "app-only" and reports the channel is clear (step D4)', async () => {
    const r = await mcp.call('set_channel', { fixture_id: 'EVB', channel: 'app-only' });
    expect(f.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ channel: 'DAZN app only' });
    expect(r.text).toContain('moved to DAZN app only');
    expect(r.text).toContain('no clash now');
  });

  it('publish_listings confirms the changed fixtures', async () => {
    const r = await mcp.call('publish_listings', { fixture_ids: ['M-1207', 'EVB'] });
    expect(r.text).toContain('Listings updated');
  });

  it('API refusals come back as tool errors and say nothing changed', async () => {
    const r = await mcp.call('update_fixture', { fixture_id: 'M-1201', kickoff: '2026-11-14T16:00:00+01:00' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("What'sOn API 409");
    expect(r.text).toContain('Nothing was changed');
  });
});
