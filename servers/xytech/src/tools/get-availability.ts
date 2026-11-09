import { cetRange, tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { isoTime, resourceId } from '../schemas.ts';

export const getAvailability = tool<Ctx>()({
  name: 'get_availability',
  title: 'Get availability',
  description:
    'Check whether Xytech resources are free in a window (e.g. a rescheduled match). For each resource: free, or busy with the work order or maintenance holding it. Read only.',
  input: {
    resource_ids: z.array(resourceId).min(1).describe('e.g. ["FIB-12","SAT-A","SAT-B","IRD-07","IRD-11"]'),
    start: isoTime,
    end: isoTime,
  },
  async run({ resource_ids, start, end }, { xytech }) {
    const a = await xytech.availability(resource_ids, start, end);
    const lines = a.results.map((r) => {
      if (r.available) return `✅ ${r.resource_id} free`;
      const c = r.conflicts[0];
      const who = c.work_order ? `${c.work_order} ${c.description}` : c.description;
      return `❌ ${r.resource_id} busy: ${who} (${cetRange(c.start, c.end)})`;
    });
    return [`Availability ${cetRange(start, end)} CET:`, ...lines].join('\n');
  },
});
