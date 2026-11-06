import { cetDay, cetTime, tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { channel, channelName, fixtureId } from '../schemas.ts';

export const setChannel = tool<Ctx>()({
  name: 'set_channel',
  write: true,
  title: 'Set channel',
  description:
    "Move a fixture to another channel in What'sOn, e.g. to \"DAZN app only\" to clear an Italy Events Channel clash. The fixture is marked Changed until publish_listings. Writes to the live schedule: needs ops approval in chat.",
  input: { fixture_id: fixtureId, channel },
  async run({ fixture_id, channel }, { whatson }) {
    const before = await whatson.fixture(fixture_id);
    const target = channelName(channel);
    const { fixture: f } = await whatson.update(fixture_id, { channel: target });
    const lines = [
      target === 'DAZN app only'
        ? `${f.match} (${f.id}) moved to DAZN app only: no linear slot in Italy, still on the DAZN app in ${f.territories.join(', ')}.`
        : `${f.match} (${f.id}) moved to ${f.channel}.`,
    ];
    if (before.channel !== f.channel && before.channel !== 'DAZN app only') {
      const day = before.kickoff.slice(0, 10);
      const left = await whatson.fixtures({ date: day, channel: before.channel });
      const clashing = left.filter((x) => x.channel_clash?.length);
      lines.push(
        clashing.length
          ? `⚠️ ${before.channel} still has a clash on ${cetDay(before.kickoff)}.`
          : `✅ ${before.channel} on ${cetDay(before.kickoff)}: no clash now. On air: ${left.map((x) => `${cetTime(x.kickoff)} ${x.match} (${x.id})`).join(', ') || 'nothing'}.`,
      );
    }
    lines.push('Listing unpublished until publish_listings.');
    return lines.join('\n');
  },
});
