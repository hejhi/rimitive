import type { AnalyticsEvent, Site, SiteDetail, SiteTraffic } from './types.js';
import { apiFetch } from './api-fetch.js';

export async function fetchSites(): Promise<Site[]> {
  const res = await apiFetch('/api/sites');
  if (!res.ok) {
    throw new Error(`Failed to fetch sites: ${res.status}`);
  }
  return res.json();
}

export async function fetchSiteDetail(id: string): Promise<SiteDetail> {
  const res = await apiFetch(`/api/sites/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch site detail: ${res.status}`);
  }
  return res.json();
}

export async function fetchSiteTraffic(siteId: string): Promise<SiteTraffic> {
  const res = await apiFetch(`/api/sites/${siteId}/traffic`);
  if (!res.ok) {
    throw new Error(`Failed to fetch site traffic: ${res.status}`);
  }
  return res.json();
}

// Re-export SITES for client-side usage (already loaded via API)
export { SITES } from './api-sites.js';
