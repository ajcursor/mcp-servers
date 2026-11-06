export class ApiError extends Error {
  constructor(
    readonly system: string,
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(`${system} API ${status} ${code}: ${message}`);
  }
}

export interface ApiClientOptions {
  system: string;
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
  retries?: number;
  timeoutMs?: number;
}

export type Query = Record<string, string | number | boolean | string[] | undefined>;

export interface ApiClient {
  get<T = any>(path: string, query?: Query): Promise<T>;
  post<T = any>(path: string, body?: unknown): Promise<T>;
  patch<T = any>(path: string, body?: unknown): Promise<T>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * JSON REST client for a vendor API. Retries network errors, 429 and 5xx (never 4xx, so writes
 * aren't repeated after a refusal) and turns error bodies into ApiError with the vendor's message.
 */
export function createApiClient(opts: ApiClientOptions): ApiClient {
  const doFetch = opts.fetch ?? fetch;
  const retries = opts.retries ?? 2;
  const base = opts.baseUrl.replace(/\/+$/, '');

  async function call<T>(method: string, path: string, query?: Query, body?: unknown): Promise<T> {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v === undefined || v === '') continue;
      url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt) await sleep(250 * 2 ** (attempt - 1));
      let res: Response;
      try {
        res = await doFetch(url, {
          method,
          headers: { authorization: `Bearer ${opts.token}`, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
        });
      } catch (e) {
        lastErr = new ApiError(opts.system, 0, 'unreachable', `can't reach ${url.origin} (${(e as Error).message})`);
        continue;
      }
      const text = await res.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: { code: 'bad_response', message: text.slice(0, 200) } };
      }
      if (res.ok) return data as T;
      const err = new ApiError(opts.system, res.status, data?.error?.code ?? 'error', data?.error?.message ?? res.statusText, data?.error?.details);
      if (res.status === 429 || res.status >= 500) { lastErr = err; continue; }
      throw err;
    }
    throw lastErr;
  }

  return {
    get: (path, query) => call('GET', path, query),
    post: (path, body) => call('POST', path, undefined, body ?? {}),
    patch: (path, body) => call('PATCH', path, undefined, body ?? {}),
  };
}
