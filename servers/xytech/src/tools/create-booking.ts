import { cetRange, gbp, tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { costLine } from '../format.ts';
import { isoTime, resourceId, workOrder } from '../schemas.ts';

export const createBooking = tool<Ctx>()({
  name: 'create_booking',
  title: 'Create booking',
  write: true,
  description:
    "Book a Xytech resource for a work order in a window, e.g. a satellite backup for the new kick-off. If it replaces the work order's old booking of the same kind, the old one is released. Pass cost_approved_by when it takes the work order over budget. Books real resources: needs ops approval in chat.",
  input: {
    work_order: workOrder,
    resource_id: resourceId,
    start: isoTime,
    end: isoTime,
    role: z.enum(['main', 'backup']).optional().describe('Defaults to backup for satellite, main otherwise'),
    cost_approved_by: z.string().optional().describe('Who approved any overspend, e.g. Ops user'),
  },
  async run(args, { xytech }) {
    const r = await xytech.create(args);
    const b = r.booking;
    const lines = [`Booked ${b.resource_id} for ${b.work_order} ${cetRange(b.start, b.end)} (${b.role}) · ${gbp(b.rate.amount)}${b.approved_by ? ` · approved by ${b.approved_by}` : ''}. Booking ${b.id}.`];
    if (r.released.length) lines.push(`Released ${r.released.map((x) => `${x.resource_id} (${cetRange(x.start, x.end)})`).join(', ')}.`);
    if (r.work_order.cost) lines.push(costLine(r.work_order.cost));
    return lines.join('\n');
  },
});
