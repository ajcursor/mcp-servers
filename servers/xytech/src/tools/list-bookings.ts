import { cetDay, tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { workOrderCard, workOrderLine } from '../format.ts';
import { date, eventId, workOrderId, type WorkOrder } from '../schemas.ts';

const byStart = (a: WorkOrder, b: WorkOrder) => Date.parse(a.start) - Date.parse(b.start);

export const listBookings = tool<Ctx>()({
  name: 'list_bookings',
  title: 'List bookings',
  description:
    "List Xytech bookings for one work order, one What'sOn event id, or one CET date. A date lists one line per work order (its window, resources and phase). Pass exactly one of work_order, event_id or date. Read only.",
  input: {
    work_order: workOrderId.optional(),
    event_id: eventId.optional(),
    date: date.optional(),
  },
  async run({ work_order, event_id, date }, { xytech }) {
    const chosen = [work_order, event_id, date].filter((v) => v != null && v !== '').length;
    if (chosen !== 1) throw new Error('Pass exactly one of work_order, event_id or date.');
    if (date) {
      const orders = [...(await xytech.bookingsByDate(date))].sort(byStart);
      const day = cetDay(`${date}T12:00:00Z`);
      if (!orders.length) return `No work orders on ${day}.`;
      const noun = orders.length === 1 ? 'work order' : 'work orders';
      return [`${orders.length} ${noun} on ${day} (CET):`, ...orders.map((wo) => workOrderLine(wo, { clocksOnly: true }))].join('\n');
    }
    if (work_order) return workOrderCard(await xytech.workOrder(work_order));
    const orders = [...(await xytech.workOrdersByEvent(event_id!))].sort(byStart);
    if (!orders.length) return `No work orders for ${event_id}.`;
    const noun = orders.length === 1 ? 'work order' : 'work orders';
    return [`${orders.length} ${noun} for ${event_id}:`, ...orders.map((wo) => workOrderLine(wo, { clocksOnly: false }))].join('\n');
  },
});
