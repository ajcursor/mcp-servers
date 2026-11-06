import { cetRange, tool } from '@dazn-ops/mcp-kit';
import type { Ctx } from '../client.ts';
import { elementId, isoTime } from '../schemas.ts';

export const getResourceHealth = tool<Ctx>()({
  name: 'get_resource_health',
  title: 'Get resource health',
  description:
    'Health of one MCR resource in Skyline DataMiner (decoder, fibre receiver, gateway): status, live parameters, active alarms and its jobs this weekend. Pass start/end to check whether it is free in a window. Read only.',
  input: { element_id: elementId, start: isoTime.optional(), end: isoTime.optional() },
  async run({ element_id, start, end }, { dataminer }) {
    const el = await dataminer.element(element_id);
    const healthy = el.status === 'Normal';
    const params = Object.entries(el.params).map(([k, v]) => `${k} ${v}`).join(' · ');
    const lines = [
      `${el.id} (${el.type}, ${el.location}): ${healthy ? '✅ healthy' : `⚠️ ${el.status}`} · ${params}`,
      el.alarms.length ? `Active alarms: ${el.alarms.map((a) => `${a.severity} ${a.id} "${a.description}" (${a.state})`).join('; ')}` : 'No active alarms.',
    ];
    if (start && end) {
      const s = Date.parse(start), e = Date.parse(end);
      const busy = el.bookings.filter((b) => Date.parse(b.start) < e && Date.parse(b.end) > s);
      lines.push(busy.length ? `❌ Busy ${cetRange(start, end)}: ${busy.map((b) => `${b.job_id} ${b.name} ${b.label}`).join('; ')}` : `✅ No DataMiner jobs on ${el.id} ${cetRange(start, end)}.`);
    } else {
      lines.push(`Jobs this weekend: ${el.bookings.map((b) => `${b.job_id} ${b.label}`).join('; ') || 'none'}`);
    }
    return lines.join('\n');
  },
});
