import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { env, isMain, registerTools, startHttpMcpServer } from '@dazn-ops/mcp-kit';
import { clientFromEnv, type Ctx } from './client.ts';
import { checkChannelClash } from './tools/check-channel-clash.ts';
import { getFixture } from './tools/get-fixture.ts';
import { listFixtures } from './tools/list-fixtures.ts';
import { publishListings } from './tools/publish-listings.ts';
import { setChannel } from './tools/set-channel.ts';
import { updateFixture } from './tools/update-fixture.ts';

export const NAME = 'whatson';
export const VERSION = '1.0.0';
export const TOOLS = [getFixture, listFixtures, checkChannelClash, updateFixture, setChannel, publishListings];

export function register(server: McpServer, ctx: Ctx = { whatson: clientFromEnv() }): void {
  registerTools(server, TOOLS, ctx);
}

if (isMain(import.meta.url)) {
  const ctx = { whatson: clientFromEnv() };
  startHttpMcpServer({ name: NAME, version: VERSION, port: Number(env('PORT', '4201')), register: (s) => register(s, ctx) });
}
