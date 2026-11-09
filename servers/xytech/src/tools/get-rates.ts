import { cetRange, gbp, tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { isoTime, resourceId } from '../schemas.ts';

export const getRates = tool<Ctx>()({
  name: 'get_rates',
  title: 'Get rates',
  description: 'Rate-card price for booking one Xytech resource in a window (e.g. the Sunday satellite premium). Read only.',
  input: { resource_id: resourceId, start: isoTime, end: isoTime },
  async run({ resource_id, start, end }, { xytech }) {
    const r = await xytech.rate(resource_id, start, end);
    return `${r.resource_id} · ${cetRange(start, end)}: ${gbp(r.amount)} (${r.rate_card}, ${r.basis})`;
  },
});
