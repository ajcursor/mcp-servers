import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { fixtureRow } from '../format.ts';
import { channel, channelName, date } from '../schemas.ts';

export const listFixtures = tool<Ctx>()({
  name: 'list_fixtures',
  title: 'List fixtures',
  description: "List What'sOn fixtures, optionally for one CET date, channel or status, sorted by kick-off. Read only.",
  input: {
    date: date.optional(),
    channel: channel.optional(),
    status: z.enum(['confirmed', 'changed', 'review', 'completed']).optional(),
  },
  async run({ date, channel, status }, { whatson }) {
    const list = await whatson.fixtures({ date, channel: channel && channelName(channel), status });
    const scope = [date, channel && channelName(channel), status].filter(Boolean).join(' · ');
    if (!list.length) return `No fixtures${scope ? ` for ${scope}` : ''}.`;
    return [`${list.length} fixtures${scope ? ` (${scope})` : ''}, times CET:`, ...list.map(fixtureRow)].join('\n');
  },
});
