import { z } from 'zod';

export const CHANNELS = ['Italy Events Channel', 'DAZN 1', 'DAZN 2', 'DAZN app only'] as const;

export const fixtureId = z.string().min(1).describe("What'sOn event id, e.g. M-1207 or EVB");
export const isoTime = z.string().min(1).describe('ISO 8601 time in CET, e.g. 2026-11-15T20:45:00+01:00');
export const channel = z.string().min(1).describe(`Channel name: ${CHANNELS.join(', ')}`);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('CET date, e.g. 2026-11-15');

export interface Clash {
  event_id: string;
  match: string;
  channel: string;
  start: string;
  end: string;
  overlap_min: number;
}

export interface Fixture {
  id: string;
  match: string;
  competition: string;
  round: number;
  venue: string;
  kickoff: string;
  end: string;
  duration_min: number;
  territories: string[];
  channel: string;
  services: { type: 'ott' | 'linear'; name: string; territories: string[] }[];
  status: 'confirmed' | 'changed' | 'review' | 'completed';
  listing_state: 'published' | 'unpublished';
  channel_clash: Clash[] | null;
}

export interface ClashCheck {
  fixture_id?: string;
  match?: string;
  channel: string;
  window?: { start: string; end: string; label: string };
  clash: boolean;
  clashes: Clash[];
}

/** Common ways people say "app only" → the What'sOn channel name. */
export function channelName(input: string): string {
  const s = input.trim().toLowerCase().replace(/[-_]/g, ' ');
  if (/app\s*only|^dazn app$|^app$|ott only/.test(s)) return 'DAZN app only';
  if (/italy events|^iec$/.test(s)) return 'Italy Events Channel';
  return CHANNELS.find((c) => c.toLowerCase() === s) ?? input.trim();
}
