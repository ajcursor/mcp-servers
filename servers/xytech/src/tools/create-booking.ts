import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { bookingCard } from '../format.ts';
import { isoTime, resourceId, workOrderId } from '../schemas.ts';

export const createBooking = tool<Ctx>()({
  name: 'create_booking',
  write: true,
  title: 'Create booking',
  description: 'Book a Xytech resource onto a work order for a CET window. Optional role and who approved the cost. Writes a live booking: needs ops approval in chat.',
  input: {
    work_order: workOrderId,
    resource_id: resourceId,
    start: isoTime,
    end: isoTime,
    role: z.string().min(1).optional().describe('Role on the work order, e.g. TX'),
    cost_approved_by: z.string().min(1).optional().describe('Who approved the cost, e.g. Ally Jarrett'),
  },
  async run(args, { xytech }) {
    const { booking } = await xytech.createBooking(args);
    const resource = [booking.resource_id, booking.resource_name].filter(Boolean).join(' ');
    const headline = `Booked ${resource} on ${booking.work_order} ${booking.work_order_name}`;
    return bookingCard(booking, headline);
  },
});
