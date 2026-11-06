import { z } from 'zod';

export const resourceId = z.string().min(1).describe('Xytech resource id, e.g. FIB-12, SAT-B, IRD-11');
export const workOrder = z.string().min(1).describe('Work order number, e.g. WO-58231');
export const bookingId = z.string().min(1).describe('Booking id from list_bookings, e.g. BKG-58231-01');
export const isoTime = z.string().min(1).describe('ISO 8601 time in CET, e.g. 2026-11-15T19:45:00+01:00');
export const resourceType = z.enum(['fibre', 'satellite', 'decoder', 'gateway']);

export interface Resource {
  id: string;
  type: z.infer<typeof resourceType>;
  name: string;
  location: string;
}

export interface Conflict {
  kind: 'booking' | 'maintenance';
  booking_id: string | null;
  work_order: string | null;
  description: string;
  start: string;
  end: string;
}

export interface Availability {
  window: { start: string; end: string };
  results: { resource_id: string; type: string; available: boolean; conflicts: Conflict[] }[];
}

export interface Booking {
  id: string;
  work_order: string;
  resource_id: string;
  resource_type: string;
  role: 'main' | 'backup';
  start: string;
  end: string;
  status: 'booked' | 'released';
  rate: { amount: number; currency: string };
  approved_by: string | null;
}

export interface Cost {
  budget: number;
  booked: number;
  projected: number;
  variance: number;
  approval: { status: string; approved_by?: string };
}

export interface WorkOrder {
  work_order: string;
  description: string;
  alias: string | null;
  event_id: string | null;
  phase: string;
  assigned_to: string | null;
  start: string;
  end: string;
  resources: string[];
  bookings?: Booking[];
  cost?: Cost;
}

export interface Rate {
  resource_id: string;
  rate_card: string;
  amount: number;
  currency: string;
  basis: string;
}
