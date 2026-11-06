import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { env, isMain, registerTools, startHttpMcpServer } from '@dazn-ops/mcp-kit';
import { clientFromEnv, type Ctx } from './client.ts';
import { clearAlarm } from './tools/clear-alarm.ts';
import { getResourceHealth } from './tools/get-resource-health.ts';
import { listJobs } from './tools/list-jobs.ts';
import { moveJob } from './tools/move-job.ts';
import { raiseAlarm } from './tools/raise-alarm.ts';

export const NAME = 'dataminer';
export const VERSION = '1.0.0';
export const TOOLS = [getResourceHealth, listJobs, moveJob, raiseAlarm, clearAlarm];

export function register(server: McpServer, ctx: Ctx = { dataminer: clientFromEnv() }): void {
  registerTools(server, TOOLS, ctx);
}

if (isMain(import.meta.url)) {
  const ctx = { dataminer: clientFromEnv() };
  startHttpMcpServer({ name: NAME, version: VERSION, port: Number(env('PORT', '4203')), register: (s) => register(s, ctx) });
}
