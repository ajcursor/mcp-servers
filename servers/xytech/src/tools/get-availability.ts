import { cetRange, tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { availabilityLine } from '../format.ts';
import { isoTime, resourceId } from '../schemas.ts';

export const getAvailability = tool<Ctx>()({
  name: 'get_availability',
  title: 'Check availability',
  description: 'Check whether Xytech resources are free, held or busy between start and end (CET). ✅ free, ⚠️ warning, ❌ busy. Read only.',
  input: {
    resource_ids: z.array(resourceId).min(1).describe('Resource ids, e.g. FIB-14, IRD-11'),
    start: isoTime,
    end: isoTime,
  },
  async run({ resource_ids, start, end }, { xytech }) {
    const found = await xytech.availability({ resource_ids, start, end });
    const byId = new Map(found.map((a) => [a.resource_id, a]));
    const availability = resource_ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
    if (!availability.length) return `No availability for ${resource_ids.join(', ')}.`;
    const noun = availability.length === 1 ? 'resource' : 'resources';
    return [`${availability.length} ${noun} · ${cetRange(start, end)} CET:`, ...availability.map(availabilityLine)].join('\n');
  },
});
