import { cet, cetDay, cetRange, cetTime, gbp } from '@dazn-ops/mcp-kit';
import type { Availability, Booking, RateQuote, Resource, WorkOrder } from './schemas.ts';

export function resourceLine(r: Resource, showType: boolean): string {
  const site = r.site ? ` · ${r.site}` : '';
  const type = showType ? ` · ${r.type}` : '';
  return `• ${r.id} ${r.name}${type}${site}`;
}

export function statusMark(status: string): string {
  const s = status.toLowerCase();
  if (s === 'free' || s === 'available' || s === 'clear') return '✅';
  if (s === 'warning' || s === 'hold' || s === 'held' || s === 'tentative') return '⚠️';
  if (s === 'busy' || s === 'booked' || s === 'conflict') return '❌';
  return status;
}

export function clockRange(start: string, end: string): string {
  const endClock = cetTime(end) === '00:00' ? '24:00' : cetTime(end);
  if (cetDay(start) === cetDay(end) || cetTime(end) === '00:00') return `${cetTime(start)}–${endClock}`;
  return `${cetTime(start)}–${cet(end)}`;
}

function shownRange(start: string, end: string, clocksOnly = false): string | undefined {
  if (!start || !end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) return undefined;
  return clocksOnly ? clockRange(start, end) : cetRange(start, end);
}

export function workOrderLine(wo: WorkOrder, opts: { clocksOnly: boolean }): string {
  const window = opts.clocksOnly ? clockRange(wo.start, wo.end) : cetRange(wo.start, wo.end);
  const resources = wo.resources.map((r) => r.id).filter(Boolean).join(', ') || 'no resources';
  const who = [wo.id, wo.name].filter(Boolean).join(' ');
  return `• ${window} · ${who} · ${resources} · ${wo.phase}`;
}

export function workOrderCard(wo: WorkOrder): string {
  const resources = wo.resources
    .map((r) => [r.id, r.name].filter(Boolean).join(' ') + (r.role ? ` (${r.role})` : ''))
    .filter(Boolean)
    .join(', ') || 'none';
  const who = [wo.id, wo.name].filter(Boolean).join(' ');
  const lines = [`${who} · ${cetRange(wo.start, wo.end)} CET · ${wo.phase}`, `Resources: ${resources}`];
  if (wo.event_id) lines.push(`Event: ${wo.event_id}`);
  return lines.join('\n');
}

export function availabilityLine(a: Availability): string {
  const mark = statusMark(a.status);
  const bits = [`${mark} ${a.resource_id} ${a.name}`];
  if (a.note) bits.push(a.note);
  if (a.booking) {
    const when = shownRange(a.booking.start, a.booking.end, true);
    bits.push([a.booking.work_order, a.booking.name, when].filter(Boolean).join(' '));
  }
  else if (!a.note && (a.status === 'free' || a.status === 'available' || a.status === 'clear')) bits.push('free');
  return bits.join(' · ');
}

export function rateCard(q: RateQuote): string {
  const window = shownRange(q.start, q.end) ?? 'unknown window';
  const lines = [`${q.resource_id} ${q.name} · ${window} CET · ${gbp(q.total)}`];
  for (const row of q.breakdown ?? []) lines.push(`• ${row.label} ${gbp(row.amount)}`);
  return lines.join('\n');
}

export function bookingCard(b: Booking, headline: string): string {
  const who = b.cost_approved_by ? ` · cost approved by ${b.cost_approved_by}` : '';
  const role = b.role ? ` · ${b.role}` : '';
  const rate = b.rate != null ? ` · ${gbp(b.rate)}` : '';
  const resource = [b.resource_id, b.resource_name].filter(Boolean).join(' ');
  return [headline, `${resource} · ${cetRange(b.start, b.end)} CET · ${b.phase}${rate}`, `Booking ${b.id}${role}${who}.`].join('\n');
}
