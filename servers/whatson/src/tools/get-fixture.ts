import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { fixtureCard } from '../format.ts';
import { fixtureId } from '../schemas.ts';

export const getFixture = tool<Ctx>()({
  name: 'get_fixture',
  title: 'Get fixture',
  description:
    "Look up one fixture in Mediagenix What'sOn by event id (e.g. M-1207) or by team name: kick-off (CET), duration, territories, services (DAZN app + linear channel), status, listing state and any channel clash. Read only.",
  input: {
    fixture_id: fixtureId.optional(),
    team: z.string().optional().describe('A team name, e.g. Juventus, if you do not know the event id'),
  },
  async run({ fixture_id, team }, { whatson }) {
    if (fixture_id) return fixtureCard(await whatson.fixture(fixture_id));
    if (!team) throw new Error('Pass fixture_id (e.g. M-1207) or team');
    const q = team.toLowerCase();
    const matches = (await whatson.fixtures()).filter((f) => f.match.toLowerCase().includes(q));
    if (!matches.length) return `No Round 12 fixture involving "${team}" in What'sOn.`;
    return matches.map(fixtureCard).join('\n\n');
  },
});
