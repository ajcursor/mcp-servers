import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import { ApiError } from './client.ts';

/** Every write tool's description must contain this, so bots ask the ops user before calling it. */
export const APPROVAL_NOTE = 'needs ops approval in chat';

export interface Tool<Ctx, S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  input: S;
  write?: boolean;
  run: (args: z.infer<z.ZodObject<S>>, ctx: Ctx) => Promise<string>;
}

/** `export const getThing = tool<Ctx>()({ ... })` keeps each tool's args typed from its zod shape. */
export function tool<Ctx>() {
  return <S extends z.ZodRawShape>(t: Tool<Ctx, S>): Tool<Ctx, S> => t;
}

export function errorText(e: unknown, write = false): string {
  const msg = e instanceof ApiError ? e.message : `Error: ${(e as Error).message}`;
  return write ? `${msg}\nNothing was changed.` : msg;
}

export function registerTools<Ctx>(server: McpServer, tools: Tool<Ctx, any>[], ctx: Ctx): void {
  for (const t of tools) {
    if (!!t.write !== t.description.toLowerCase().includes(APPROVAL_NOTE)) {
      throw new Error(`${t.name}: write tools (and only write tools) must say they "${APPROVAL_NOTE}"`);
    }
    const annotations = t.write
      ? { title: t.title, readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
      : { title: t.title, readOnlyHint: true, openWorldHint: false };
    const handler = async (args: unknown) => {
      try {
        return { content: [{ type: 'text' as const, text: await t.run(args as never, ctx) }] };
      } catch (e) {
        return { isError: true, content: [{ type: 'text' as const, text: errorText(e, t.write) }] };
      }
    };
    (server.registerTool as (...a: unknown[]) => unknown)(t.name, { title: t.title, description: t.description, inputSchema: t.input, annotations }, handler);
  }
}
