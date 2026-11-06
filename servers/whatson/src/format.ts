import { cet, cetRange, cetTime } from '@dazn-ops/mcp-kit';
import type { Clash, Fixture } from './schemas.ts';

const STATUS: Record<Fixture['status'], string> = { confirmed: 'Confirmed', changed: 'Changed', review: 'Needs review', completed: 'Completed' };

export const clashLine = (c: Clash) => `${c.match} (${c.event_id}) ${cetTime(c.start)}–${cetTime(c.end)}, ${c.overlap_min} min overlap`;

export function services(f: Fixture): string {
  const app = f.services.find((s) => s.type === 'ott');
  const linear = f.services.find((s) => s.type === 'linear');
  return [app && `DAZN app in ${app.territories.join(', ')}`, linear ? `${linear.name} (linear, Italy)` : 'no linear channel (app only)'].filter(Boolean).join(' · ');
}

export function fixtureCard(f: Fixture): string {
  const lines = [
    `${f.id} · ${f.match} · ${f.competition} Round ${f.round} · ${f.venue}`,
    `Kick-off: ${cet(f.kickoff)} CET · ${f.duration_min} min (to ${cetTime(f.end)})`,
    `Services: ${services(f)}`,
    `Status: ${STATUS[f.status]} · listing ${f.listing_state}`,
  ];
  if (f.channel_clash?.length) lines.push(`⚠️ Channel clash on the ${f.channel}: overlaps ${f.channel_clash.map(clashLine).join('; ')}`);
  return lines.join('\n');
}

export function fixtureRow(f: Fixture): string {
  return `${cet(f.kickoff)} · ${f.id} ${f.match} · ${f.channel} · ${f.territories.join(', ')} · ${STATUS[f.status]}${f.channel_clash?.length ? ' ⚠️ clash' : ''}`;
}

export function windowOf(f: Fixture): string {
  return cetRange(f.kickoff, f.end);
}
