import { cetRange, tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { costLine } from '../format.ts';
import { bookingId, isoTime, resourceId } from '../schemas.ts';

export const amendBooking = tool<Ctx>()({
  name: 'amend_booking',
  title: 'Amend booking',
  write: true,
  description:
    'Move an existing Xytech booking to a new window and/or onto another resource of the same type (e.g. FIB-12 to Sun 19:45–23:00, or IRD-07 → IRD-11). Get booking ids from list_bookings. Fails without changes if the resource is busy. Changes real bookings: needs ops approval in chat.',
  input: {
    booking_id: bookingId,
    start: isoTime.optional(),
    end: isoTime.optional(),
    resource_id: resourceId.optional(),
    cost_approved_by: z.string().optional(),
  },
  async run({ booking_id, ...p }, { xytech }) {
    const r = await xytech.amend(booking_id, p);
    const b = r.booking;
    const head = r.previous.resource_id !== b.resource_id
      ? `${b.resource_id} booked for ${b.work_order} ${cetRange(b.start, b.end)} (${b.id}, was ${r.previous.resource_id} ${cetRange(r.previous.start, r.previous.end)}).`
      : `Moved ${b.resource_id} to ${cetRange(b.start, b.end)} for ${b.work_order} (${b.id}, was ${cetRange(r.previous.start, r.previous.end)}).`;
    return [head, ...(r.work_order.cost ? [costLine(r.work_order.cost)] : [])].join('\n');
  },
});
