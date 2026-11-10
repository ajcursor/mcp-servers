import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { formatAvailability } from '../format.ts';
import { isoTime, resourceId } from '../schemas.ts';

export const getAvailability = tool<Ctx>()({
  name: 'get_availability',
  title: 'Get availability',
  description: 'Check whether resources are free, busy or on hold between two CET times. Read only.',
  input: {
    resource_ids: z.array(resourceId).min(1).describe('Resource ids, e.g. FIB-14'),
    start: isoTime,
    end: isoTime.describe('ISO 8601 time in CET, e.g. 2026-11-15T14:15:00+01:00'),
  },
  async run({ resource_ids, start, end }, { xytech }) {
    return formatAvailability(await xytech.availability(resource_ids, start, end), start, end);
  },
});
