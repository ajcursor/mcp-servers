import { cetRange, cetTime, gbp } from '@dazn-ops/mcp-kit';
import type { Booking, Cost, WorkOrder } from './schemas.ts';

export const woName = (w: WorkOrder) => `${w.work_order} ${w.alias ? `${w.alias}: ` : ''}${w.description}`;

/** "12:00–14:15 · WO-58244 Women's Serie A – Live · FIB-14, IRD-11 · Pending" */
export const woRow = (w: WorkOrder) => `${cetTime(w.start)}–${cetTime(w.end)} · ${woName(w)} · ${w.resources.join(', ')} · ${w.phase}`;

export const bookingRow = (b: Booking) => `${b.id} · ${b.resource_id} (${b.role}) · ${cetRange(b.start, b.end)} · ${gbp(b.rate.amount)}`;

export function costLine(c: Cost): string {
  const over = c.variance > 0 ? ` (+${gbp(c.variance)} over budget, ${c.approval.status === 'approved' ? `approved by ${c.approval.approved_by}` : c.approval.status})` : ' (within budget)';
  return c.projected !== c.booked
    ? `Cost: ${gbp(c.booked)} booked, ${gbp(c.projected)} projected vs ${gbp(c.budget)} budget${over}`
    : `Cost: ${gbp(c.booked)} booked vs ${gbp(c.budget)} budget${over}`;
}
