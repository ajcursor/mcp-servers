import { createApiClient, env, type ApiClient } from '@dazn-ops/mcp-kit';
import type { ClashCheck, Fixture } from './schemas.ts';

/** Mediagenix What'sOn REST API, called with the svc-grokbot-whatson service account. */
export function whatsonClient(api: ApiClient) {
  const id = (x: string) => encodeURIComponent(x.trim());
  return {
    fixture: (fixtureId: string) => api.get<Fixture>(`/fixtures/${id(fixtureId)}`),
    fixtures: async (q: { date?: string; channel?: string; status?: string } = {}) => (await api.get<{ fixtures: Fixture[] }>('/fixtures', q)).fixtures,
    clashCheck: (fixtureId: string, p: { kickoff?: string; channel?: string } = {}) => api.post<ClashCheck>(`/fixtures/${id(fixtureId)}/clash-check`, p),
    slotCheck: (channel: string, start: string, duration_min: number, exclude_event_id?: string) =>
      api.post<ClashCheck>(`/channels/${id(channel)}/clash-check`, { start, duration_min, exclude_event_id }),
    update: (fixtureId: string, p: { kickoff?: string; duration_min?: number; channel?: string; status?: string }) =>
      api.patch<{ fixture: Fixture; changed: string[] }>(`/fixtures/${id(fixtureId)}`, p),
    publish: (p: { event_ids?: string[]; channel?: string }) => api.post<{ published: string[]; fixtures: Fixture[] }>('/listings/publish', p),
  };
}

export type WhatsonClient = ReturnType<typeof whatsonClient>;
export interface Ctx {
  whatson: WhatsonClient;
}

export function clientFromEnv(fetchImpl?: typeof fetch): WhatsonClient {
  return whatsonClient(
    createApiClient({
      system: "What'sOn",
      baseUrl: env('WHATSON_API_URL', 'http://127.0.0.1:4101/api/v1'),
      token: env('WHATSON_API_TOKEN', 'dev-whatson-token'),
      fetch: fetchImpl,
    }),
  );
}
