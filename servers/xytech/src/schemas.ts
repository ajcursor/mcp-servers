import { z } from 'zod';

export const resourceType = z.string().min(1).describe('Resource type, e.g. fibre');
export const resourceId = z.string().min(1).describe('Resource id, e.g. FIB-14');
export const isoTime = z.string().min(1).describe('ISO 8601 time in CET, e.g. 2026-11-15T12:00:00+01:00');
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('CET date, e.g. 2026-11-15');
export const workOrderId = z.string().min(1).describe('Work order id, e.g. WO-58244');
export const eventId = z.string().min(1).describe('Event id, e.g. EVB');
export const bookingId = z.string().min(1).describe('Booking id, e.g. BK-1001');
export const role = z.string().min(1).describe('Role on the booking, e.g. primary');
export const approver = z.string().min(1).describe('Who approved the cost, e.g. Alex');

export interface Resource {
  id: string;
  name?: string;
  type?: string;
  site?: string;
}

export interface Conflict {
  work_order?: string;
  start?: string;
  end?: string;
}

export interface Availability {
  id: string;
  name?: string;
  /** Raw vendor state or status: free, warning, busy, and the aliases of those. */
  state?: string;
  note?: string;
  bookings: Conflict[];
  conflicts: Conflict[];
}

export interface CreateBookingBody {
  work_order: string;
  resource_id: string;
  start: string;
  end: string;
  role?: string;
  cost_approved_by?: string;
}

export interface AmendBookingBody {
  start?: string;
  end?: string;
  resource_id?: string;
  cost_approved_by?: string;
}
