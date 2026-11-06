import { cetRange, cetTime, tool } from '@dazn-ops/mcp-kit';
import { z } from 'zod';
import type { Ctx } from '../client.ts';
import { elementId, isoTime, jobId } from '../schemas.ts';

export const moveJob = tool<Ctx>()({
  name: 'move_job',
  title: 'Move job',
  write: true,
  description:
    'Move a DataMiner MediaOps job to a new window and optionally swap its resources (e.g. JOB-M1207 to Sun 19:45–23:00 on FIB-12 + IRD-11). Changes what the MCR automation runs: needs ops approval in chat.',
  input: {
    job_id: jobId,
    start: isoTime,
    end: isoTime,
    resources: z.array(elementId).optional().describe('Full new resource list; omit to keep the current one'),
  },
  async run({ job_id, start, end, resources }, { dataminer }) {
    const r = await dataminer.moveJob(job_id, { start, end, resources });
    const swapped = r.previous.resources.filter((x) => !r.job.resources.some((y) => y.id === x));
    const lines = [
      `Event job moved: ${r.job.id} ${r.job.name} now ${cetRange(r.job.start, r.job.end)} CET on ${r.job.resources.map((x) => x.id).join(', ')} (pre-roll from ${cetTime(r.job.start)}).`,
      `Was ${cetRange(r.previous.start, r.previous.end)}${swapped.length ? `; released ${swapped.join(', ')}` : ''}.`,
    ];
    if (r.warnings.length) lines.push(`⚠️ ${r.warnings.join('; ')}`);
    return lines.join('\n');
  },
});
