import { cet, tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { clashLine } from '../format.ts';
import { fixtureId, isoTime } from '../schemas.ts';

export const updateFixture = tool<Ctx>()({
  name: 'update_fixture',
  write: true,
  title: 'Update fixture',
  description:
    "Change a fixture's kick-off, duration or status in What'sOn. A kick-off change marks it Changed and unpublishes its listing until publish_listings. Writes to the live schedule: needs ops approval in chat.",
  input: {
    fixture_id: fixtureId,
    kickoff: isoTime.optional(),
    duration_min: z.number().int().min(15).optional(),
    status: z.enum(['confirmed', 'changed', 'review', 'completed']).optional(),
  },
  async run({ fixture_id, kickoff, duration_min, status }, { whatson }) {
    const { fixture: f, changed } = await whatson.update(fixture_id, { kickoff, duration_min, status });
    if (!changed.length) return `No change: ${f.id} ${f.match} already matches.`;
    const lines = [`Updated ${f.id} ${f.match}: kick-off ${cet(f.kickoff)} CET, ${f.duration_min} min. Status ${f.status}, listing ${f.listing_state}.`];
    if (f.channel_clash?.length) lines.push(`⚠️ Still clashes on the ${f.channel} with ${f.channel_clash.map(clashLine).join('; ')}.`);
    return lines.join('\n');
  },
});
