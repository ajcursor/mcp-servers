import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { rateCard } from '../format.ts';
import { isoTime, resourceId } from '../schemas.ts';

export const getRates = tool<Ctx>()({
  name: 'get_rates',
  title: 'Get rates',
  description: 'Look up the Xytech rate for one resource between start and end, in GBP. Read only.',
  input: { resource_id: resourceId, start: isoTime, end: isoTime },
  async run({ resource_id, start, end }, { xytech }) {
    return rateCard(await xytech.rates({ resource_id, start, end }));
  },
});
