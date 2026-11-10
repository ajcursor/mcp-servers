import { createApiClient, env, type ApiClient } from '@dazn-ops/mcp-kit';
import type { AmendBookingBody, Availability, Conflict, CreateBookingBody, Resource } from './schemas.ts';

/** Xytech MediaPulse REST API, called with the svc-grokbot-xytech service account. */
export function xytechClient(api: ApiClient) {
  const id = (x: string) => encodeURIComponent(x.trim());
  return {
    async resources(type?: string): Promise<Resource[]> {
      const raw = unwrapList(await api.get<unknown>('/resources', { type }), ['resources', 'items', 'data']);
      return raw.map(toResource).filter((r): r is Resource => !!r);
    },
    async availability(resource_ids: string[], start: string, end: string): Promise<Availability[]> {
      const raw = await api.get<unknown>('/availability', { resource_ids: resource_ids.join(','), start, end });
      return availabilityRows(raw).map(toAvailability).filter((r): r is Availability => !!r);
    },
    async workOrder(workOrderId: string): Promise<unknown> {
      return unwrapRecord(await api.get<unknown>(`/work-orders/${id(workOrderId)}`), ['work_order', 'workOrder']);
    },
    async workOrdersByEvent(event_id: string): Promise<unknown[]> {
      const data = await api.get<unknown>('/work-orders', { event_id });
      const list = unwrapList(data, ['work_orders', 'workOrders', 'items', 'data']);
      if (list.length) return list;
      const rec = asRecord(data);
      if (rec && (typeof rec.id === 'string' || typeof rec.work_order === 'string')) return [rec];
      return list;
    },
    bookingsOn(date: string): Promise<unknown> {
      return api.get<unknown>('/bookings', { date });
    },
    async rates(resource_id: string, start: string, end: string): Promise<unknown> {
      return unwrapRecord(await api.get<unknown>('/rates', { resource_id, start, end }), ['rate', 'quote']);
    },
    async createBooking(body: CreateBookingBody): Promise<unknown> {
      return unwrapRecord(await api.post<unknown>('/bookings', defined(body)), ['booking']);
    },
    async amendBooking(bookingId: string, body: AmendBookingBody): Promise<unknown> {
      return unwrapRecord(await api.patch<unknown>(`/bookings/${id(bookingId)}`, defined(body)), ['booking']);
    },
  };
}

export type XytechClient = ReturnType<typeof xytechClient>;
export interface Ctx {
  xytech: XytechClient;
}

export function clientFromEnv(fetchImpl?: typeof fetch): XytechClient {
  return xytechClient(
    createApiClient({
      system: 'Xytech',
      baseUrl: env('XYTECH_API_URL', 'http://127.0.0.1:4902/api/v1'),
      token: env('XYTECH_API_TOKEN', 'dev-xytech-token'),
      fetch: fetchImpl,
    }),
  );
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  return undefined;
}

function str(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = o[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Pull a list out of `{ resources }` / `{ availability }` / a bare array. A single row object is kept. */
function unwrapList(data: unknown, keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  const rec = asRecord(data);
  if (!rec) return [];
  for (const key of keys) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
    const inner = asRecord(rec[key]);
    if (inner && str(inner, ['id', 'resource_id'])) return [inner];
  }
  if (str(rec, ['id', 'resource_id'])) return [rec];
  return [];
}

/** Pull `{ work_order }` / `{ booking }` / `{ rate }` / `{ quote }` out, keeping sibling fields. Numbers stay put. */
function unwrapRecord(data: unknown, keys: string[]): Record<string, unknown> {
  const rec = asRecord(data);
  if (!rec) return {};
  for (const key of keys) {
    const inner = asRecord(rec[key]);
    if (inner) return { ...rec, ...inner };
  }
  return rec;
}

function defined<T extends object>(body: T): Partial<T> {
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function toResource(v: unknown): Resource | undefined {
  const o = asRecord(v);
  if (!o) return undefined;
  const id = str(o, ['id', 'resource_id', 'code']);
  if (!id) return undefined;
  return {
    id,
    name: str(o, ['name', 'resource_name', 'title']),
    type: str(o, ['type', 'resource_type', 'kind', 'category']),
    site: str(o, ['site', 'location', 'site_name', 'city']),
  };
}

function toConflicts(v: unknown): Conflict[] {
  const list = Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
  const out: Conflict[] = [];
  for (const item of list) {
    const o = asRecord(item);
    if (!o) continue;
    out.push({
      work_order: str(o, ['work_order', 'work_order_id', 'wo', 'workOrder']),
      start: str(o, ['start', 'from', 'starts_at']),
      end: str(o, ['end', 'to', 'ends_at']),
    });
  }
  return out;
}

const AVAIL_KEYS = ['availability', 'resources', 'items', 'results', 'slots', 'entries', 'data', 'windows'] as const;

/** A list, a single row, or a map of resource id → status. */
function availabilityRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const rec = asRecord(data);
  if (!rec) return [];
  for (const key of AVAIL_KEYS) {
    const v = rec[key];
    if (Array.isArray(v)) return v;
    const inner = asRecord(v);
    if (!inner) continue;
    if (rowId(inner)) return [inner];
    const mapped = Object.entries(inner).flatMap(([k, val]) => {
      if (typeof val === 'string') return [{ resource_id: k, state: val }];
      const o = asRecord(val);
      return o ? [{ resource_id: rowId(o) ?? k, ...o }] : [];
    });
    if (mapped.length) return mapped;
  }
  return rowId(rec) ? [rec] : [];
}

function rowId(o: Record<string, unknown>): string | undefined {
  const nested = asRecord(o.resource);
  return (
    str(o, ['resource_id', 'id', 'code', 'resource_code']) ??
    (typeof o.resource === 'string' ? o.resource.trim() : undefined) ??
    (nested && str(nested, ['id', 'resource_id', 'code', 'resource_code']))
  );
}

function stateText(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  const o = asRecord(v);
  return o ? str(o, ['code', 'name', 'state', 'status', 'value']) : undefined;
}

function toAvailability(v: unknown): Availability | undefined {
  const o = asRecord(v);
  if (!o) return undefined;
  const nested = asRecord(o.resource);
  const id = rowId(o);
  if (!id) return undefined;
  let state = stateText(o.state ?? o.status ?? o.availability);
  if (!state) {
    if (o.busy === true || o.available === false || o.free === false) state = 'busy';
    else if (o.available === true || o.free === true) state = 'free';
    else if (nested) state = stateText(nested.state ?? nested.status ?? nested.availability);
  }
  return {
    id,
    name: str(o, ['name', 'resource_name', 'title']) ?? (nested && str(nested, ['name', 'resource_name', 'title'])),
    state,
    note: str(o, ['note', 'reason', 'message', 'detail']),
    bookings: toConflicts(o.bookings ?? o.booking),
    conflicts: toConflicts(o.conflicts ?? o.conflict),
  };
}
