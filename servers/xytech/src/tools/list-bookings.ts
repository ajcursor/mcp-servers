import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { formatDateOrders, formatEventOrders, formatWorkOrder } from '../format.ts';
import { date, eventId, workOrderId } from '../schemas.ts';

export const listBookings = tool<Ctx>()({
  name: 'list_bookings',
  title: 'List bookings',
  description: 'Show bookings for one work order, one event, or one CET date, one line per work order. Read only.',
  input: {
    work_order: workOrderId.optional().describe('Work order id, e.g. WO-58244'),
    event_id: eventId.optional().describe('Event id, e.g. EVB'),
    date: date.optional().describe('CET date, e.g. 2026-11-15'),
  },
  async run({ work_order, event_id, date: day }, { xytech }) {
    if (work_order) return formatWorkOrder(await xytech.workOrder(work_order));
    if (event_id) return formatEventOrders(event_id, await xytech.workOrdersByEvent(event_id));
    if (day) return formatDateOrders(day, await xytech.bookingsOn(day));
    throw new Error('Pass work_order, event_id or date');
  },
});
