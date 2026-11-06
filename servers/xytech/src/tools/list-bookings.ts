import { cetDay, cetRange, tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { bookingRow, costLine, woName, woRow } from '../format.ts';
import type { WorkOrder } from '../schemas.ts';
import { workOrder } from '../schemas.ts';

const detail = (w: WorkOrder) =>
  [
    `${woName(w)}${w.event_id ? ` (What'sOn ${w.event_id})` : ''} · ${cetRange(w.start, w.end)} CET · ${w.phase} · ${w.assigned_to ?? 'Unassigned'}`,
    'Bookings:',
    ...(w.bookings ?? []).map((b) => `• ${bookingRow(b)}`),
    ...(w.cost ? [costLine(w.cost)] : []),
  ].join('\n');

export const listBookings = tool<Ctx>()({
  name: 'list_bookings',
  title: 'List bookings',
  description:
    "List Xytech bookings for a work order (WO-58231), a What'sOn event (M-1207), or a CET date (2026-11-15: one line per work order with its window, resources and phase). Includes booking ids for amend_booking and the work order's cost vs budget. Read only.",
  input: {
    work_order: workOrder.optional(),
    event_id: z.string().optional().describe("What'sOn event id, e.g. M-1207"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('CET date, e.g. 2026-11-15'),
  },
  async run({ work_order, event_id, date }, { xytech }) {
    if (work_order) return detail(await xytech.workOrder(work_order));
    if (event_id) {
      const wos = await xytech.workOrdersForEvent(event_id);
      return wos.length ? wos.map(detail).join('\n\n') : `No Xytech work order for event ${event_id}.`;
    }
    if (date) {
      const { work_orders } = await xytech.bookingsOn(date);
      const day = cetDay(`${date}T12:00:00+01:00`);
      if (!work_orders.length) return `No work orders on ${day}.`;
      return [`${work_orders.length} work orders on ${day} (CET):`, ...work_orders.map(woRow)].join('\n');
    }
    throw new Error('Pass work_order, event_id or date');
  },
});
