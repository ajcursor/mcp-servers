import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { channel, channelName, fixtureId } from '../schemas.ts';

export const publishListings = tool<Ctx>()({
  name: 'publish_listings',
  write: true,
  title: 'Publish listings',
  description:
    "Publish EPG listings for changed fixtures so partners see the new schedule (Changed → Confirmed). Pass fixture_ids, or a channel; with neither, publishes every changed fixture. Updates live listings: needs ops approval in chat.",
  input: {
    fixture_ids: z.array(fixtureId).optional(),
    channel: channel.optional(),
  },
  async run({ fixture_ids, channel }, { whatson }) {
    const r = await whatson.publish({ event_ids: fixture_ids, channel: channel && channelName(channel) });
    if (!r.published.length) return 'Listings already up to date. Nothing to publish.';
    return `Listings updated: published ${r.fixtures.map((f) => `${f.match} (${f.id}) on ${f.channel}`).join(', ')}. ${r.published.length === 1 ? 'It is' : 'All are'} now Confirmed in What'sOn.`;
  },
});
