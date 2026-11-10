import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { formatAmended } from '../format.ts';
import type { AmendBookingBody } from '../schemas.ts';
import { approver, bookingId, isoTime, resourceId } from '../schemas.ts';

export const amendBooking = tool<Ctx>()({
  name: 'amend_booking',
  write: true,
  title: 'Amend booking',
  description: "Change a booking's window, resource or cost approver. Writes the booking: needs ops approval in chat.",
  input: {
    booking_id: bookingId,
    start: isoTime.optional().describe('New start, ISO 8601 CET, e.g. 2026-11-15T13:00:00+01:00'),
    end: isoTime.optional().describe('New end, ISO 8601 CET, e.g. 2026-11-15T15:15:00+01:00'),
    resource_id: resourceId.optional().describe('Replacement resource id, e.g. FIB-14'),
    cost_approved_by: approver.optional().describe('Who approved the cost, e.g. Alex'),
  },
  async run({ booking_id, start, end, resource_id, cost_approved_by }, { xytech }) {
    const body: AmendBookingBody = {};
    if (start !== undefined) body.start = start;
    if (end !== undefined) body.end = end;
    if (resource_id !== undefined) body.resource_id = resource_id;
    if (cost_approved_by !== undefined) body.cost_approved_by = cost_approved_by;
    if (!Object.keys(body).length) return 'Pass start, end, resource_id or cost_approved_by.';
    const booking = await xytech.amendBooking(booking_id, body);
    return formatAmended(booking, { booking_id, start, end, resource_id });
  },
});
