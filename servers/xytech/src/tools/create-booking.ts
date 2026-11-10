import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { formatCreated } from '../format.ts';
import { approver, isoTime, resourceId, role, workOrderId } from '../schemas.ts';

export const createBooking = tool<Ctx>()({
  name: 'create_booking',
  write: true,
  title: 'Create booking',
  description: 'Book a resource on a work order for a CET window. Writes a booking: needs ops approval in chat.',
  input: {
    work_order: workOrderId,
    resource_id: resourceId,
    start: isoTime,
    end: isoTime.describe('ISO 8601 time in CET, e.g. 2026-11-15T14:15:00+01:00'),
    role: role.optional().describe('Role on the booking, e.g. primary'),
    cost_approved_by: approver.optional().describe('Who approved the cost, e.g. Alex'),
  },
  async run({ work_order, resource_id, start, end, role: bookingRole, cost_approved_by }, { xytech }) {
    const booking = await xytech.createBooking({
      work_order,
      resource_id,
      start,
      end,
      ...(bookingRole !== undefined ? { role: bookingRole } : {}),
      ...(cost_approved_by !== undefined ? { cost_approved_by } : {}),
    });
    return formatCreated(booking, { work_order, resource_id, start, end });
  },
});
