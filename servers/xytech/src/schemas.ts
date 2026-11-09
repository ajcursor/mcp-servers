import { z } from 'zod';

export const resourceId = z.string().min(1).describe('Xytech resource id, e.g. FIB-14 or IRD-11');
export const workOrderId = z.string().min(1).describe('Work order id, e.g. WO-58244');
export const bookingId = z.string().min(1).describe('Booking id, e.g. BK-9001');
export const eventId = z.string().min(1).describe("What'sOn event id, e.g. EVB");
export const isoTime = z.string().min(1).describe('ISO 8601 time in CET, e.g. 2026-11-15T12:00:00+01:00');
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('CET date, e.g. 2026-11-15');
export const resourceType = z.string().min(1).describe('Resource type, e.g. fibre, ird, studio');

export interface Resource {
  id: string;
  name: string;
  type: string;
  site?: string;
}

export interface ResourceRef {
  id: string;
  name?: string;
  role?: string;
}

export interface BusyBooking {
  work_order: string;
  name: string;
  start: string;
  end: string;
}

export interface Availability {
  resource_id: string;
  name: string;
  status: 'free' | 'warning' | 'busy' | string;
  note?: string;
  booking?: BusyBooking | null;
}

export interface WorkOrder {
  id: string;
  name: string;
  event_id?: string;
  start: string;
  end: string;
  phase: string;
  resources: ResourceRef[];
  bookings?: Booking[];
}

export interface Booking {
  id: string;
  work_order: string;
  work_order_name: string;
  event_id?: string;
  resource_id: string;
  resource_name?: string;
  role?: string;
  start: string;
  end: string;
  phase: string;
  rate?: number;
  cost_approved_by?: string;
}

export interface RateQuote {
  resource_id: string;
  name: string;
  start: string;
  end: string;
  total: number;
  currency?: string;
  breakdown?: { label: string; amount: number }[];
}
