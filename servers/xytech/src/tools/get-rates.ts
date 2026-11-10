import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { formatRate } from '../format.ts';
import { isoTime, resourceId } from '../schemas.ts';

export const getRates = tool<Ctx>()({
  name: 'get_rates',
  title: 'Get rates',
  description: 'Quote the rate for one resource between two CET times. Read only.',
  input: {
    resource_id: resourceId,
    start: isoTime,
    end: isoTime.describe('ISO 8601 time in CET, e.g. 2026-11-15T14:15:00+01:00'),
  },
  async run({ resource_id, start, end }, { xytech }) {
    return formatRate(await xytech.rates(resource_id, start, end), { resource_id, start, end });
  },
});
