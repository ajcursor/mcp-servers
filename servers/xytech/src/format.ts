import { cet, cetDay, cetRange, cetTime, gbp } from '@dazn-ops/mcp-kit';
import type { Availability, Resource } from './schemas.ts';

const DASH = '–';

interface NamedId {
  id: string;
  name?: string;
}

interface OrderView {
  id: string;
  name?: string;
  eventId?: string;
  start?: string;
  end?: string;
  phase?: string;
  resources: NamedId[];
}

const FREE = new Set(['free', 'available', 'clear', 'ok']);
const WARN = new Set(['warning', 'warn', 'tight', 'hold']);
const BUSY = new Set(['busy', 'booked', 'conflict', 'unavailable']);
const MONEY_KEYS = ['total_gbp', 'total', 'amount', 'rate', 'rate_gbp', 'cost_gbp', 'price_gbp', 'amount_gbp'] as const;

function label(id: string, name?: string): string {
  const n = name?.trim();
  return n ? `${id} ${n}` : id;
}

function endClock(iso: string): string {
  const t = cetTime(iso);
  return t === '00:00' || t === '24:00' ? '24:00' : t;
}

/** Clock span for a day header that already names the date. Midnight end is 24:00. */
function shortRange(start: string, end: string): string {
  const midnight = cetTime(end) === '00:00' || cetTime(end) === '24:00';
  const sameDay = cetDay(start) === cetDay(end) || midnight;
  return sameDay ? `${cetTime(start)}${DASH}${midnight ? '24:00' : cetTime(end)}` : `${cetTime(start)}${DASH}${cet(end)}`;
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

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function moneyOf(o: Record<string, unknown>, depth = 0): number | undefined {
  for (const key of MONEY_KEYS) {
    const n = asNumber(o[key]);
    if (n !== undefined) return n;
  }
  if (depth > 0) return undefined;
  for (const key of ['cost', 'price', 'quote', 'rate'] as const) {
    const inner = asRecord(o[key]);
    if (!inner) continue;
    const n = moneyOf(inner, 1);
    if (n !== undefined) return n;
  }
  return undefined;
}

function earlier(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

function later(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function resourcesOf(o: Record<string, unknown>): NamedId[] {
  const out: NamedId[] = [];
  const add = (id?: string, name?: string) => {
    if (!id) return;
    const existing = out.find((r) => r.id === id);
    if (!existing) out.push({ id, name });
    else if (name && !existing.name) existing.name = name;
  };
  for (const key of ['resources', 'resource_ids'] as const) {
    const list = o[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === 'string') add(item.trim());
      else {
        const rec = asRecord(item);
        if (rec) add(str(rec, ['id', 'resource_id', 'code']), str(rec, ['name', 'resource_name', 'title']));
      }
    }
  }
  if (typeof o.resource === 'string') add(o.resource.trim());
  else {
    const one = asRecord(o.resource);
    if (one) add(str(one, ['id', 'resource_id', 'code']), str(one, ['name', 'resource_name', 'title']));
  }
  add(str(o, ['resource_id']), str(o, ['resource_name']));
  return out;
}

function rowsFrom(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  const rec = asRecord(data);
  if (!rec) return [];
  const keys = ['bookings', 'work_orders', 'orders', 'items', 'data'] as const;
  const arrays = keys.map((key) => rec[key]).filter((v): v is unknown[] => Array.isArray(v));
  const nonempty = arrays.find((rows) => rows.length > 0);
  if (nonempty) return nonempty;
  if (arrays.length) return arrays[0] ?? [];
  const nested = asRecord(rec.work_order);
  if (nested) return [nested];
  if (str(rec, ['id', 'work_order', 'work_order_id'])) return [rec];
  return [];
}

/** One line per work order: earliest start, latest end, resource ids in first-seen order. */
function groupRows(rows: unknown[]): OrderView[] {
  const map = new Map<string, OrderView>();
  const order: string[] = [];
  for (const row of rows) {
    const o = asRecord(row);
    if (!o) continue;
    const id = str(o, ['work_order', 'work_order_id', 'wo', 'id']);
    if (!id) continue;
    let group = map.get(id);
    if (!group) {
      group = { id, resources: [] };
      map.set(id, group);
      order.push(id);
    }
    const name = str(o, ['name', 'title', 'work_order_name']);
    if (name && !group.name) group.name = name;
    const eventId = str(o, ['event_id', 'event']);
    if (eventId && !group.eventId) group.eventId = eventId;
    const phase = str(o, ['phase', 'status']);
    if (phase && !group.phase) group.phase = phase;
    group.start = earlier(group.start, str(o, ['start', 'from', 'starts_at']));
    group.end = later(group.end, str(o, ['end', 'to', 'ends_at']));
    for (const resource of resourcesOf(o)) {
      const existing = group.resources.find((r) => r.id === resource.id);
      if (!existing) group.resources.push(resource);
      else if (resource.name && !existing.name) existing.name = resource.name;
    }
  }
  return order
    .map((id) => map.get(id))
    .filter((g): g is OrderView => !!g)
    .sort((a, b) => (a.start ? Date.parse(a.start) : Number.POSITIVE_INFINITY) - (b.start ? Date.parse(b.start) : Number.POSITIVE_INFINITY));
}

function ordersFrom(data: unknown): OrderView[] {
  return groupRows(rowsFrom(data));
}

function orderWhen(order: OrderView, style: 'day' | 'clock'): string | undefined {
  if (!order.start || !order.end) return undefined;
  return style === 'day' ? cetRange(order.start, order.end) : shortRange(order.start, order.end);
}

export function formatResources(resources: Resource[], type?: string): string {
  if (!resources.length) return type ? `No ${type} resources.` : 'No resources.';
  const noun = resources.length === 1 ? 'resource' : 'resources';
  const header = type ? `${resources.length} ${type} ${noun}:` : `${resources.length} ${noun}:`;
  const lines = resources.map((r) => {
    const tail = [type ? undefined : r.type, r.site].filter((x): x is string => !!x);
    const head = label(r.id, r.name);
    return tail.length ? `• ${head} · ${tail.join(' · ')}` : `• ${head}`;
  });
  return [header, ...lines].join('\n');
}

function availabilityKind(row: Availability): 'free' | 'warning' | 'busy' {
  const raw = (row.state ?? '').trim().toLowerCase();
  if (FREE.has(raw)) return 'free';
  if (WARN.has(raw)) return 'warning';
  if (BUSY.has(raw)) return 'busy';
  return row.bookings.length || row.conflicts.length ? 'busy' : 'free';
}

export function formatAvailability(rows: Availability[], start: string, end: string): string {
  const header = `${cetRange(start, end)}:`;
  const lines = rows.map((row) => {
    const who = label(row.id, row.name);
    const kind = availabilityKind(row);
    if (kind === 'free') return `✅ ${who} is free`;
    if (kind === 'warning') return row.note ? `⚠️ ${who} · ${row.note}` : `⚠️ ${who}`;
    const hits = [...row.bookings, ...row.conflicts].filter((c) => c.work_order);
    const extra = hits
      .map((c) => (c.start && c.end ? `${c.work_order} ${cetTime(c.start)}${DASH}${endClock(c.end)}` : c.work_order))
      .join(` · `);
    return extra ? `❌ ${who} is busy · ${extra}` : `❌ ${who} is busy`;
  });
  return [header, ...lines].join('\n');
}

export function formatWorkOrder(raw: unknown): string {
  const order = ordersFrom(raw)[0];
  if (!order) return 'No work order.';
  const phase = order.phase ?? 'Pending';
  const title = `${label(order.id, order.name)}${order.eventId ? ` (${order.eventId})` : ''} · ${phase}`;
  const second = [orderWhen(order, 'day'), order.resources.map((r) => label(r.id, r.name)).join(', ') || undefined].filter((p): p is string => !!p).join(' · ');
  return second ? `${title}\n${second}` : title;
}

export function formatEventOrders(eventId: string, raw: unknown): string {
  const orders = ordersFrom(raw);
  if (!orders.length) return `No work orders for ${eventId}.`;
  const noun = orders.length === 1 ? 'work order' : 'work orders';
  const lines = orders.map((order) => `• ${[orderWhen(order, 'day'), label(order.id, order.name), order.resources.map((r) => r.id).join(', ') || undefined, order.phase ?? 'Pending'].filter((p): p is string => !!p).join(' · ')}`);
  return [`${orders.length} ${noun} for ${eventId}:`, ...lines].join('\n');
}

export function formatDateOrders(date: string, raw: unknown): string {
  const day = cetDay(`${date}T12:00:00+01:00`);
  const orders = ordersFrom(raw);
  if (!orders.length) return `No work orders on ${day} (CET).`;
  const noun = orders.length === 1 ? 'work order' : 'work orders';
  const lines = orders.map((order) => `• ${[orderWhen(order, 'clock'), label(order.id, order.name), order.resources.map((r) => r.id).join(', ') || undefined, order.phase ?? 'Pending'].filter((p): p is string => !!p).join(' · ')}`);
  return [`${orders.length} ${noun} on ${day} (CET):`, ...lines].join('\n');
}

function quoteSource(raw: unknown): Record<string, unknown> {
  const o = asRecord(raw) ?? {};
  const inner = asRecord(o.rate) ?? asRecord(o.quote);
  return inner ? { ...o, ...inner } : o;
}

function breakdownLines(o: Record<string, unknown>): string[] {
  if (!Array.isArray(o.breakdown)) return [];
  const lines: string[] = [];
  for (const item of o.breakdown) {
    const rec = asRecord(item);
    if (!rec) continue;
    const text = str(rec, ['label', 'name']);
    const amount = asNumber(rec.amount_gbp ?? rec.amount ?? rec.total_gbp ?? rec.rate_gbp);
    if (text && amount !== undefined) lines.push(`• ${text} ${gbp(amount)}`);
  }
  return lines;
}

export function formatRate(raw: unknown, req: { resource_id: string; start: string; end: string }): string {
  const src = quoteSource(raw);
  const id = str(src, ['resource_id', 'id']) ?? req.resource_id;
  const name = str(src, ['resource_name', 'name', 'title']);
  const start = str(src, ['start', 'from']) ?? req.start;
  const end = str(src, ['end', 'to']) ?? req.end;
  const total = moneyOf(src);
  const parts = [label(id, name), cetRange(start, end)];
  if (total !== undefined) parts.push(gbp(total));
  return [parts.join(' · '), ...breakdownLines(src)].join('\n');
}

function bookingSource(raw: unknown): Record<string, unknown> {
  const o = asRecord(raw) ?? {};
  const inner = asRecord(o.booking);
  return inner ? { ...o, ...inner } : o;
}

function resourceBits(src: Record<string, unknown>, fallbackId?: string): { id?: string; name?: string } {
  const resource = asRecord(src.resource);
  const fromList = resourcesOf(src)[0];
  const id = str(src, ['resource_id']) ?? (resource && str(resource, ['id', 'resource_id', 'code'])) ?? fromList?.id ?? fallbackId;
  const name = str(src, ['resource_name']) ?? (resource && str(resource, ['name', 'resource_name', 'title'])) ?? fromList?.name;
  return { id, name };
}

export function formatCreated(raw: unknown, req: { work_order: string; resource_id: string; start: string; end: string }): string {
  const src = bookingSource(raw);
  const resource = resourceBits(src, req.resource_id);
  const workOrder = str(src, ['work_order', 'work_order_id']) ?? req.work_order;
  const workOrderName = str(src, ['work_order_name', 'title']) ?? (str(src, ['name']) !== resource.name ? str(src, ['name']) : undefined);
  const start = str(src, ['start', 'from']) ?? req.start;
  const end = str(src, ['end', 'to']) ?? req.end;
  const total = moneyOf(src);
  const id = str(src, ['booking_id', 'id']);
  const parts = [`Booked ${label(resource.id ?? req.resource_id, resource.name)} on ${label(workOrder, workOrderName)}`, cetRange(start, end)];
  if (total !== undefined) parts.push(gbp(total));
  if (id) parts.push(id);
  return parts.join(' · ');
}

export function formatAmended(
  raw: unknown,
  req: { booking_id: string; start?: string; end?: string; resource_id?: string },
): string {
  const src = bookingSource(raw);
  const id = str(src, ['booking_id', 'id']) ?? req.booking_id;
  const workOrder = str(src, ['work_order', 'work_order_id']);
  const start = str(src, ['start', 'from']) ?? req.start;
  const end = str(src, ['end', 'to']) ?? req.end;
  const resource = resourceBits(src, req.resource_id);
  const parts = [`Amended ${id}`];
  if (workOrder) parts.push(workOrder);
  if (start && end) parts.push(cetRange(start, end));
  if (resource.id) parts.push(label(resource.id, resource.name));
  return parts.join(' · ');
}
