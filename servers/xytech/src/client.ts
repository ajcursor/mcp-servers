import { createApiClient, env, type ApiClient } from '@dazn-ops/mcp-kit';
import type { Availability, Booking, BusyBooking, RateQuote, ResourceRef, WorkOrder } from './schemas.ts';

function rows(data: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== 'object') return [];
  const bag = data as Record<string, unknown>;
  for (const key of keys) if (Array.isArray(bag[key])) return bag[key] as Record<string, unknown>[];
  return [];
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function iso(value: unknown, fallback?: string): string | undefined {
  const raw = text(value);
  if (raw && !Number.isNaN(Date.parse(raw))) return raw;
  return fallback;
}

function money(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  if (value && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    for (const key of ['gbp', 'amount', 'total', 'value', 'rate']) {
      const n = money(bag[key]);
      if (n !== undefined) return n;
    }
  }
  return undefined;
}

function ref(value: unknown): ResourceRef | undefined {
  if (typeof value === 'string') return { id: value };
  if (!value || typeof value !== 'object') return undefined;
  const bag = value as Record<string, unknown>;
  const id = text(bag.id) ?? text(bag.resource_id);
  if (!id) return undefined;
  return { id, name: text(bag.name) ?? text(bag.resource_name), role: text(bag.role) };
}

function resourceRefs(value: unknown): ResourceRef[] {
  if (typeof value === 'string') return value.split(',').flatMap((part) => { const resource = ref(part.trim()); return resource?.id ? [resource] : []; });
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const resource = ref(item); return resource?.id ? [resource] : []; });
}

function listedResources(bag: Record<string, unknown>): ResourceRef[] {
  return [bag.resources, bag.resource_ids, bag.booked_resources].reduce<ResourceRef[]>((best, value) => {
    const refs = resourceRefs(value);
    return refs.length > best.length ? refs : best;
  }, []);
}

function workOrderOf(value: unknown): WorkOrder | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const bag = value as Record<string, unknown>;
  const nested = bag.work_order && typeof bag.work_order === 'object' ? (bag.work_order as Record<string, unknown>) : undefined;
  const window = (bag.window && typeof bag.window === 'object' ? bag.window : nested?.window && typeof nested.window === 'object' ? nested.window : {}) as Record<string, unknown>;
  const start = iso(bag.start ?? bag.from ?? nested?.start ?? nested?.from ?? window.start) ?? '';
  const end = iso(bag.end ?? bag.to ?? nested?.end ?? nested?.to ?? window.end) ?? '';
  const id = text(bag.id) ?? text(bag.work_order) ?? text(bag.work_order_id) ?? text(bag.number) ?? text(nested?.id) ?? text(nested?.work_order_id) ?? text(nested?.number) ?? '';
  const name = text(bag.name) ?? text(bag.work_order_name) ?? text(bag.title) ?? text(nested?.name) ?? text(nested?.work_order_name) ?? text(nested?.title) ?? '';
  if (!id && !name && !start && !end) return undefined;
  let resources = listedResources(bag);
  if (!resources.length && nested) resources = listedResources(nested);
  return {
    id,
    name,
    event_id: text(bag.event_id) ?? text(bag.event) ?? (nested ? text(nested.event_id) : undefined),
    start,
    end,
    phase: text(bag.phase) ?? text(bag.status) ?? text(bag.state) ?? (nested ? text(nested.phase) : undefined) ?? '',
    resources,
    bookings: Array.isArray(bag.bookings) ? (bag.bookings as Booking[]) : undefined,
  };
}

function asWorkOrders(value: unknown): WorkOrder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => { const wo = workOrderOf(row); return wo ? [wo] : []; });
}

function workOrdersIn(data: unknown): WorkOrder[] {
  if (Array.isArray(data)) return asWorkOrders(data);
  if (!data || typeof data !== 'object') return [];
  const bag = data as Record<string, unknown>;
  if (Array.isArray(bag.work_orders)) return asWorkOrders(bag.work_orders);
  const own = workOrderOf(bag);
  if (own) return [own];
  for (const key of ['orders', 'items', 'bookings']) {
    const list = asWorkOrders(bag[key]);
    if (list.length) return list;
  }
  return [];
}

function bookingOf(value: unknown): BusyBooking | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const bag = value as Record<string, unknown>;
  const start = iso(bag.start ?? bag.from);
  const end = iso(bag.end ?? bag.to);
  if (!start || !end) return undefined;
  return {
    work_order: text(bag.work_order) ?? text(bag.work_order_id) ?? text(bag.id) ?? '',
    name: text(bag.name) ?? text(bag.work_order_name) ?? text(bag.title) ?? '',
    start,
    end,
  };
}

function availabilityOf(item: Record<string, unknown>): Availability {
  const nested = item.booking ?? item.conflict ?? (Array.isArray(item.bookings) ? item.bookings[0] : undefined) ?? (Array.isArray(item.conflicts) ? item.conflicts[0] : undefined);
  let status = text(item.status) ?? text(item.state) ?? text(item.availability);
  if (!status) {
    if (item.free === true || item.available === true) status = 'free';
    else if (item.busy === true || item.free === false || nested) status = 'busy';
    else status = 'free';
  }
  return {
    resource_id: text(item.resource_id) ?? text(item.id) ?? '',
    name: text(item.name) ?? text(item.resource_name) ?? '',
    status,
    note: text(item.note) ?? text(item.warning) ?? text(item.message),
    booking: bookingOf(nested),
  };
}

function quoteOf(data: unknown, q: { resource_id: string; start: string; end: string }): RateQuote {
  const bag = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const quote = (bag.rate && typeof bag.rate === 'object' ? bag.rate : bag.quote && typeof bag.quote === 'object' ? bag.quote : Array.isArray(bag.rates) ? bag.rates[0] : bag) as Record<string, unknown>;
  const window = (quote.window && typeof quote.window === 'object' ? quote.window : {}) as Record<string, unknown>;
  const lines = quote.breakdown ?? quote.lines ?? quote.components;
  return {
    resource_id: text(quote.resource_id) ?? text(quote.id) ?? q.resource_id,
    name: text(quote.name) ?? text(quote.resource_name) ?? q.resource_id,
    start: iso(quote.start ?? quote.from ?? window.start, q.start) ?? q.start,
    end: iso(quote.end ?? quote.to ?? window.end, q.end) ?? q.end,
    total: money(quote.total) ?? money(quote.amount) ?? money(quote.rate) ?? money(quote.price) ?? money(quote.cost) ?? money(bag.total) ?? 0,
    currency: text(quote.currency) ?? text(bag.currency),
    breakdown: Array.isArray(lines)
      ? lines.flatMap((row) => {
          if (!row || typeof row !== 'object') return [];
          const line = row as Record<string, unknown>;
          const amount = money(line.amount) ?? money(line.total) ?? money(line.rate);
          const label = text(line.label) ?? text(line.description) ?? text(line.name);
          return amount !== undefined && label ? [{ label, amount }] : [];
        })
      : undefined,
  };
}

/** Xytech MediaPulse REST API, called with the svc-grokbot-xytech service account. */
export function xytechClient(api: ApiClient) {
  const id = (x: string) => encodeURIComponent(x.trim());
  return {
    resources: async (type?: string) =>
      rows(await api.get('/resources', { type }), ['resources', 'items']).flatMap((row) => {
        const resource = ref(row);
        if (!resource) return [];
        const typeName = text(row.type) ?? text(row.resource_type) ?? '';
        return [{ id: resource.id, name: resource.name ?? resource.id, type: typeName, site: text(row.site) ?? text(row.location) }];
      }),
    availability: async (q: { resource_ids: string[]; start: string; end: string }) =>
      rows(await api.get('/availability', q), ['availability', 'resources', 'slots', 'items']).map(availabilityOf),
    workOrder: async (workOrderId: string) => {
      const data = await api.get<WorkOrder>(`/work-orders/${id(workOrderId)}`);
      return workOrdersIn(data)[0] ?? data;
    },
    workOrdersByEvent: async (eventId: string) => workOrdersIn(await api.get('/work-orders', { event_id: eventId })),
    bookingsByDate: async (date: string) => workOrdersIn(await api.get('/bookings', { date })),
    rates: async (q: { resource_id: string; start: string; end: string }) => quoteOf(await api.get('/rates', q), q),
    createBooking: (body: { work_order: string; resource_id: string; start: string; end: string; role?: string; cost_approved_by?: string }) =>
      api.post<{ booking: Booking }>('/bookings', body),
    amendBooking: (bookingId: string, body: { start?: string; end?: string; resource_id?: string; cost_approved_by?: string }) =>
      api.patch<{ booking: Booking; changed: string[] }>(`/bookings/${id(bookingId)}`, body),
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
      baseUrl: env('XYTECH_API_URL', 'http://127.0.0.1:4102/api/v1'),
      token: env('XYTECH_API_TOKEN', 'dev-xytech-token'),
      fetch: fetchImpl,
    }),
  );
}
