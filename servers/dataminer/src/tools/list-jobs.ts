import { tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { isoTime } from '../schemas.ts';

export const listJobs = tool<Ctx>()({
  name: 'list_jobs',
  title: 'List jobs',
  description: 'List DataMiner MediaOps jobs (event workflows with their resources), optionally between from and to. Read only.',
  input: { from: isoTime.optional(), to: isoTime.optional() },
  async run({ from, to }, { dataminer }) {
    const jobs = await dataminer.jobs({ from, to });
    if (!jobs.length) return 'No jobs in that window.';
    return [`${jobs.length} jobs (CET):`, ...jobs.map((j) => `${j.label} · ${j.id} ${j.name} · ${j.resources.map((r) => r.id).join(', ')} · ${j.booking}, ${j.status}`)].join('\n');
  },
});
