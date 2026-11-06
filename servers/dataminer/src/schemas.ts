import { z } from 'zod';

export const elementId = z.string().min(1).describe('DataMiner element, e.g. IRD-11, IRD-07, FIB-12, GW-01');
export const jobId = z.string().min(1).describe('MediaOps job id, e.g. JOB-M1207');
export const isoTime = z.string().min(1).describe('ISO 8601 time in CET, e.g. 2026-11-15T19:45:00+01:00');
export const severity = z.enum(['Critical', 'Major', 'Minor', 'Warning', 'Info']);

export interface Alarm {
  id: string;
  severity: z.infer<typeof severity>;
  element: string;
  description: string;
  state: 'Open' | 'Acknowledged' | 'Cleared';
  raised_at: string;
  time: string;
  raised_by: string;
}

export interface Element {
  id: string;
  type: string;
  location: string;
  model: string;
  status: string;
  params: Record<string, string>;
  bookings: { job_id: string; name: string; start: string; end: string; label: string }[];
  alarms: Alarm[];
}

export interface Job {
  id: string;
  name: string;
  start: string;
  end: string;
  label: string;
  status: string;
  booking: string;
  resources: { id: string; status: string }[];
  pre_roll_min: number;
  resource_conflicts: { resource: string; job_id: string; job: string; window: string }[];
}
