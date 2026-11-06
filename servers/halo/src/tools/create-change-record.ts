import { tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { action } from '../schemas.ts';

export const createChangeRecord = tool<Ctx>()({
  name: 'create_change_record',
  title: 'Create change record',
  write: true,
  description:
    'Log a change record in HALO for a completed operational change: every action, which bot did it and who approved it. Call once, after the changes are done. Creates an audit record: needs ops approval in chat (the ops user approving the plan counts).',
  input: {
    title: z.string().min(3).describe('e.g. "Serie A R12 reschedule – Juventus vs Inter to Sun 15 Nov 20:45"'),
    summary: z.string().min(3),
    actions: z.array(action).min(1),
    links: z.array(z.string()).optional(),
  },
  async run(args, { halo }) {
    const { record: r } = await halo.create(args);
    const bots = [...new Set(r.actions.map((a) => a.bot))];
    const approvers = [...new Set(r.actions.map((a) => a.approved_by).filter(Boolean))];
    return [
      `Change record ${r.number} logged: ${r.title}`,
      `${r.actions.length} actions by ${bots.join(', ')}${approvers.length ? ` · approved by ${approvers.join(', ')}` : ''}`,
      ...r.actions.map((a) => `• ${a.system}: ${a.action} (${a.bot})`),
    ].join('\n');
  },
});
