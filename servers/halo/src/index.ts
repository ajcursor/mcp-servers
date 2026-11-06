import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { env, isMain, registerTools, startHttpMcpServer } from '@dazn-ops/mcp-kit';
import { clientFromEnv, type Ctx } from './client.ts';
import { createChangeRecord } from './tools/create-change-record.ts';

export const NAME = 'halo';
export const VERSION = '1.0.0';
export const TOOLS = [createChangeRecord];

export function register(server: McpServer, ctx: Ctx = { halo: clientFromEnv() }): void {
  registerTools(server, TOOLS, ctx);
}

if (isMain(import.meta.url)) {
  const ctx = { halo: clientFromEnv() };
  startHttpMcpServer({ name: NAME, version: VERSION, port: Number(env('PORT', '4204')), register: (s) => register(s, ctx) });
}
