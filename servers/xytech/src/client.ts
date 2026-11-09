import { createApiClient, env, type ApiClient } from '@dazn-ops/mcp-kit';
import type { Availability, Booking, RateQuote, Resource, WorkOrder } from './schemas.ts';

/** Xytech MediaPulse REST API, called with the svc-grokbot-xytech service account. */
export function xytechClient(api: ApiClient) {
  const id = (x: string) => encodeURIComponent(x.trim());
  return {
    resources: async (type?: string) => (await api.get<{ resources: Resource[] }>('/resources', { type })).resources,
    availability: async (q: { resource_ids: string[]; start: string; end: string }) =>
      (await api.get<{ availability: Availability[] }>('/availability', q)).availability,
    workOrder: (workOrderId: string) => api.get<WorkOrder>(`/work-orders/${id(workOrderId)}`),
    workOrdersByEvent: async (eventId: string) => (await api.get<{ work_orders: WorkOrder[] }>('/work-orders', { event_id: eventId })).work_orders,
    bookingsByDate: async (date: string) => (await api.get<{ work_orders: WorkOrder[] }>('/bookings', { date })).work_orders,
    rates: (q: { resource_id: string; start: string; end: string }) => api.get<RateQuote>('/rates', q),
    createBooking: (body: { work_order: string; resource_id: string; start: string; end: string; role?: string; cost_approved_by?: string }) =>
      api.post<{ booking: Booking }>('/bookings', body),
    amendBooking: (bookingId: string, body: { start?: string; end?: string; resource_id?: string; cost_approved_by?: string }) =>
      api.patch<{ booking: Booking; changed: string[] }>(`/bookings/${id(bookingId)}`, body),
  };
}

export type XytechClient = ReturnType<typeof xytechClient>;
export interface Ctx {
  xytech: XytechClient;
}

export function clientFromEnv(fetchImpl?: typeof fetch): XytechClient {
  return xytechClient(
    createApiClient({
      system: 'Xytech',
      baseUrl: env('XYTECH_API_URL', 'http://127.0.0.1:4102/api/v1'),
      token: env('XYTECH_API_TOKEN', 'dev-xytech-token'),
      fetch: fetchImpl,
    }),
  );
}
