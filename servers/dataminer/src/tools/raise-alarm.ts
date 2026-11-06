import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { elementId, severity } from '../schemas.ts';

const COLOUR: Record<string, string> = { Critical: 'red', Major: 'orange', Minor: 'yellow', Warning: 'amber', Info: 'blue' };

export const raiseAlarm = tool<Ctx>()({
  name: 'raise_alarm',
  title: 'Raise alarm',
  write: true,
  description:
    'Raise an alarm on a DataMiner element so the MCR sees it in the Alarm Console, e.g. a Warning (amber) for a resource booking conflict. Changes the live alarm console: needs ops approval in chat.',
  input: {
    element: elementId,
    severity: severity.default('Warning').describe('Warning shows amber'),
    description: z.string().min(3).describe('What the MCR should know, e.g. "Resource conflict: booked for Napoli vs Lazio (Event B) Sun 20:30–22:30"'),
  },
  async run({ element, severity, description }, { dataminer }) {
    const { alarm: a } = await dataminer.raise({ element, severity, description });
    return `Raised ${a.severity} alarm ${a.id} (${COLOUR[a.severity]}) on ${a.element} at ${a.time}: ${a.description}`;
  },
});
