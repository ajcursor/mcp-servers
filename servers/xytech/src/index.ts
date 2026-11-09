import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { env, isMain, registerTools, startHttpMcpServer } from '@dazn-ops/mcp-kit';
import { clientFromEnv, type Ctx } from './client.ts';
import { amendBooking } from './tools/amend-booking.ts';
import { createBooking } from './tools/create-booking.ts';
import { getAvailability } from './tools/get-availability.ts';
import { getRates } from './tools/get-rates.ts';
import { listBookings } from './tools/list-bookings.ts';
import { listResources } from './tools/list-resources.ts';

export const NAME = 'xytech';
export const VERSION = '1.0.0';
export const TOOLS = [listResources, getAvailability, listBookings, getRates, createBooking, amendBooking];

export function register(server: McpServer, ctx: Ctx = { xytech: clientFromEnv() }): void {
  registerTools(server, TOOLS, ctx);
}

if (isMain(import.meta.url)) {
  const ctx = { xytech: clientFromEnv() };
  startHttpMcpServer({ name: NAME, version: VERSION, port: Number(env('PORT', '4202')), register: (s) => register(s, ctx) });
}
