import { createApiClient, env, type ApiClient } from '@dazn-ops/mcp-kit';
import type { Alarm, Element, Job } from './schemas.ts';

/** Skyline DataMiner MediaOps REST API, called with the svc-grokbot-dataminer service account. */
export function dataminerClient(api: ApiClient) {
  const id = (x: string) => encodeURIComponent(x.trim());
  return {
    element: (elementId: string) => api.get<Element>(`/elements/${id(elementId)}`),
    jobs: async (q: { from?: string; to?: string } = {}) => (await api.get<{ jobs: Job[] }>('/jobs', q)).jobs,
    moveJob: (jobId: string, p: { start: string; end: string; resources?: string[] }) =>
      api.post<{ job: Job; previous: { start: string; end: string; resources: string[] }; warnings: string[] }>(`/jobs/${id(jobId)}/move`, p),
    alarms: async (state = 'active') => (await api.get<{ alarms: Alarm[] }>('/alarms', { state })).alarms,
    raise: (p: { element: string; severity?: string; description: string }) => api.post<{ alarm: Alarm }>('/alarms', p),
    clear: (alarmId: string, note?: string) => api.post<{ alarm: Alarm }>(`/alarms/${id(alarmId)}/clear`, { note }),
  };
}

export type DataminerClient = ReturnType<typeof dataminerClient>;
export interface Ctx {
  dataminer: DataminerClient;
}

export function clientFromEnv(fetchImpl?: typeof fetch): DataminerClient {
  return dataminerClient(
    createApiClient({
      system: 'DataMiner',
      baseUrl: env('DATAMINER_API_URL', 'http://127.0.0.1:4103/api/v1'),
      token: env('DATAMINER_API_TOKEN', 'dev-dataminer-token'),
      fetch: fetchImpl,
    }),
  );
}
