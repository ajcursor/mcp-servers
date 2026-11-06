import { cetRange, tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { clashLine } from '../format.ts';
import { channel, channelName, fixtureId, isoTime } from '../schemas.ts';

export const checkChannelClash = tool<Ctx>()({
  name: 'check_channel_clash',
  title: 'Check channel clash',
  description:
    "Check whether a fixture (at its current kick-off, or a proposed one) overlaps another event on its linear channel in What'sOn, e.g. after a league reschedule. Pass fixture_id (+ kickoff to test a new time), or channel + start + duration_min to test a free slot. Programmes never count as clashes. Read only.",
  input: {
    fixture_id: fixtureId.optional(),
    kickoff: isoTime.optional().describe('Proposed kick-off to test, e.g. 2026-11-15T20:45:00+01:00'),
    channel: channel.optional(),
    start: isoTime.optional(),
    duration_min: z.number().int().min(15).optional(),
  },
  async run({ fixture_id, kickoff, channel, start, duration_min }, { whatson }) {
    let r;
    if (fixture_id) r = await whatson.clashCheck(fixture_id, { kickoff, channel: channel && channelName(channel) });
    else if (channel && start && duration_min) r = await whatson.slotCheck(channelName(channel), start, duration_min);
    else throw new Error('Pass fixture_id (optionally with kickoff), or channel + start + duration_min');
    const what = r.match ? `${r.match} (${r.fixture_id})` : 'That slot';
    const when = r.window ? ` at ${cetRange(r.window.start, r.window.end)} CET` : '';
    if (!r.clash) return `✅ No clash: ${what}${when} is clear on the ${r.channel}.`;
    return [
      `⚠️ Clash on the ${r.channel}: ${what}${when} overlaps ${r.clashes.map(clashLine).join('; ')}.`,
      'One of them would need to move to app-only in Italy (set_channel), or the kick-off would need to change.',
    ].join('\n');
  },
});
