import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { resourceLine } from '../format.ts';
import { resourceType } from '../schemas.ts';

export const listResources = tool<Ctx>()({
  name: 'list_resources',
  title: 'List resources',
  description: 'List Xytech resources (studios, fibres, IRDs and other bookable kit), optionally filtered by type. Ids are shown next to names. Read only.',
  input: { type: resourceType.optional() },
  async run({ type }, { xytech }) {
    const resources = [...(await xytech.resources(type))].sort((a, b) => a.id.localeCompare(b.id));
    if (!resources.length) return `No resources${type ? ` of type ${type}` : ''}.`;
    const noun = resources.length === 1 ? 'resource' : 'resources';
    return [`${resources.length} ${noun}${type ? ` (${type})` : ''}:`, ...resources.map((r) => resourceLine(r, !type))].join('\n');
  },
});
