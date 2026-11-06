import { z } from 'zod';

export const action = z.object({
  system: z.string().describe("System changed, e.g. Xytech, What'sOn, DataMiner, Email"),
  action: z.string().describe('What changed, e.g. "FIB-12 moved to Sun 19:45–23:00"'),
  bot: z.string().describe('Bot that made the change, e.g. Bookings Bot'),
  approved_by: z.string().optional().describe('Who approved it, e.g. Ops user'),
});

export interface ChangeRecord {
  id: number;
  number: string;
  title: string;
  summary: string;
  actions: z.infer<typeof action>[];
  links: string[];
  created_at: string;
  created_by: string;
  url: string;
}
