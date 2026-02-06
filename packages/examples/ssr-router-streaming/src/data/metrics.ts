import type { OverviewMetrics, Referrer, TopPage } from './types.js';
import { apiFetch } from './api-fetch.js';

export async function fetchOverviewMetrics(): Promise<OverviewMetrics> {
  const res = await apiFetch('/api/overview');
  if (!res.ok) {
    throw new Error(`Failed to fetch overview: ${res.status}`);
  }
  return res.json();
}

export async function fetchTopPages(): Promise<TopPage[]> {
  const res = await apiFetch('/api/top-pages');
  if (!res.ok) {
    throw new Error(`Failed to fetch top pages: ${res.status}`);
  }
  return res.json();
}

export async function fetchReferrers(): Promise<Referrer[]> {
  const res = await apiFetch('/api/referrers');
  if (!res.ok) {
    throw new Error(`Failed to fetch referrers: ${res.status}`);
  }
  return res.json();
}
