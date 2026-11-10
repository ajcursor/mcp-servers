import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { formatResources } from '../format.ts';
import { resourceType } from '../schemas.ts';

export const listResources = tool<Ctx>()({
  name: 'list_resources',
  title: 'List resources',
  description: 'List bookable Xytech resources, optionally one type such as fibre. Read only.',
  input: {
    type: resourceType.optional().describe('Resource type, e.g. fibre'),
  },
  async run({ type }, { xytech }) {
    return formatResources(await xytech.resources(type), type);
  },
});
