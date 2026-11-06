import { createApiClient, env, type ApiClient } from '@dazn-ops/mcp-kit';
import type { ChangeRecord } from './schemas.ts';

/** HALO change management (the demo's stand-in for HALO / Jira change records). */
export function haloClient(api: ApiClient) {
  return {
    create: (p: Omit<ChangeRecord, 'id' | 'number' | 'created_at' | 'created_by' | 'url' | 'links'> & { links?: string[] }) =>
      api.post<{ record: ChangeRecord }>('/change-records', p),
  };
}

export type HaloClient = ReturnType<typeof haloClient>;
export interface Ctx {
  halo: HaloClient;
}

export function clientFromEnv(fetchImpl?: typeof fetch): HaloClient {
  return haloClient(
    createApiClient({
      system: 'HALO',
      baseUrl: env('HALO_API_URL', 'http://127.0.0.1:4100/api/halo/v1'),
      token: env('HALO_API_TOKEN', 'dev-halo-token'),
      fetch: fetchImpl,
    }),
  );
}
