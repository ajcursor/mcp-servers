/** All DAZN ops times are shown in CET (Europe/Rome). */
const parts = (iso: string, opts: Intl.DateTimeFormatOptions) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour12: false, ...opts }).formatToParts(new Date(iso));
  return Object.fromEntries(p.map((x) => [x.type, x.value]));
};

/** "Sun 15 Nov" */
export function cetDay(iso: string): string {
  const p = parts(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "20:45" */
export function cetTime(iso: string): string {
  const p = parts(iso, { hour: '2-digit', minute: '2-digit' });
  return `${p.hour}:${p.minute}`;
}

/** "Sun 15 Nov 20:45" */
export function cet(iso: string): string {
  return `${cetDay(iso)} ${cetTime(iso)}`;
}

/** "Sun 15 Nov 20:30–22:30" (the end's day is dropped when it's the same day or midnight). */
export function cetRange(start: string, end: string): string {
  const sameDay = cetDay(start) === cetDay(end) || cetTime(end) === '00:00';
  const endTime = cetTime(end) === '00:00' ? '24:00' : cetTime(end);
  return `${cet(start)}–${sameDay ? endTime : cet(end)}`;
}

/** "£4,750" */
export function gbp(n: number): string {
  return `${n < 0 ? '-' : ''}£${Math.abs(n).toLocaleString('en-GB')}`;
}
