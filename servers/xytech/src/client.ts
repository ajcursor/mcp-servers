import { createApiClient, env, type ApiClient } from '@dazn-ops/mcp-kit';
import type { Availability, Booking, Rate, Resource, WorkOrder } from './schemas.ts';

/** Xytech MediaPulse REST API, called with the svc-grokbot-xytech service account. */
export function xytechClient(api: ApiClient) {
  const id = (x: string) => encodeURIComponent(x.trim());
  return {
    resources: async (type?: string) => (await api.get<{ resources: Resource[] }>('/resources', { type })).resources,
    availability: (resourceIds: string[], start: string, end: string) => api.get<Availability>('/availability', { resource_ids: resourceIds, start, end }),
    workOrder: (wo: string) => api.get<WorkOrder>(`/work-orders/${id(wo)}`),
    workOrdersForEvent: async (eventId: string) => (await api.get<{ work_orders: WorkOrder[] }>('/work-orders', { event_id: eventId })).work_orders,
    bookingsOn: (date: string) => api.get<{ bookings: Booking[]; work_orders: WorkOrder[] }>('/bookings', { date }),
    rate: (resourceId: string, start: string, end: string) => api.get<Rate>('/rates', { resource_id: resourceId, start, end }),
    create: (p: { work_order: string; resource_id: string; start: string; end: string; role?: string; cost_approved_by?: string }) =>
      api.post<{ booking: Booking; released: Booking[]; work_order: WorkOrder }>('/bookings', p),
    amend: (bookingId: string, p: { start?: string; end?: string; resource_id?: string; cost_approved_by?: string }) =>
      api.patch<{ booking: Booking; previous: { resource_id: string; start: string; end: string }; work_order: WorkOrder }>(`/bookings/${id(bookingId)}`, p),
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
