import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { elementId } from '../schemas.ts';

export const clearAlarm = tool<Ctx>()({
  name: 'clear_alarm',
  title: 'Clear alarm',
  write: true,
  description:
    'Clear a DataMiner alarm once the cause is fixed. Pass alarm_id, or element to clear the open alarm raised on it (e.g. IRD-07). Changes the live alarm console: needs ops approval in chat.',
  input: {
    alarm_id: z.string().optional().describe('e.g. ALM-3107'),
    element: elementId.optional(),
    note: z.string().optional(),
  },
  async run({ alarm_id, element, note }, { dataminer }) {
    let id = alarm_id;
    if (!id) {
      if (!element) throw new Error('Pass alarm_id or element');
      const open = (await dataminer.alarms('active')).filter((a) => a.element.toLowerCase() === element.toLowerCase());
      if (!open.length) return `No active alarm on ${element}. Nothing to clear.`;
      id = open[0].id;
    }
    const { alarm: a } = await dataminer.clear(id, note);
    return `${a.element} alarm cleared (${a.id}: ${a.description}).`;
  },
});
