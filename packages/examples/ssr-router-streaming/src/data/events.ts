import type { AnalyticsEvent } from './types.js';
import { apiFetch } from './api-fetch.js';

export async function fetchRecentEvents(
  limit: number = 20
): Promise<AnalyticsEvent[]> {
  const res = await apiFetch(`/api/events?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status}`);
  }
  return res.json();
}
