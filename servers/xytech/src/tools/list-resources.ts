import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { resourceType } from '../schemas.ts';

export const listResources = tool<Ctx>()({
  name: 'list_resources',
  title: 'List resources',
  description: 'List bookable Xytech MediaPulse resources (fibre circuits, satellite slots, decoders, gateways), optionally of one type. Read only.',
  input: { type: resourceType.optional() },
  async run({ type }, { xytech }) {
    const list = await xytech.resources(type);
    return [`${list.length} ${type ? `${type} ` : ''}resources:`, ...list.map((r) => `${r.id} · ${r.type} · ${r.name} · ${r.location}`)].join('\n');
  },
});
