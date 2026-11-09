import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { bookingCard } from '../format.ts';
import { bookingId, isoTime, resourceId } from '../schemas.ts';

export const amendBooking = tool<Ctx>()({
  name: 'amend_booking',
  write: true,
  title: 'Amend booking',
  description:
    "Amend a Xytech booking's window or resource. Pass the booking id and any of start, end, resource_id, and who approved the cost. Writes a live booking: needs ops approval in chat.",
  input: {
    booking_id: bookingId,
    start: isoTime.optional(),
    end: isoTime.optional(),
    resource_id: resourceId.optional(),
    cost_approved_by: z.string().min(1).optional().describe('Who approved the cost, e.g. Ally Jarrett'),
  },
  async run({ booking_id, start, end, resource_id, cost_approved_by }, { xytech }) {
    if (start == null && end == null && resource_id == null && cost_approved_by == null) {
      throw new Error('Pass start, end, resource_id or cost_approved_by.');
    }
    const { booking, changed } = await xytech.amendBooking(booking_id, { start, end, resource_id, cost_approved_by });
    if (!changed.length) return `No change: booking ${booking.id} already matches.`;
    const headline = `Amended booking ${booking.id} on ${booking.work_order} ${booking.work_order_name}`;
    return `${bookingCard(booking, headline)}\nChanged: ${changed.join(', ')}.`;
  },
});
