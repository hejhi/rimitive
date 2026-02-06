// Export all data types
export type {
  AnalyticsEvent,
  OverviewMetrics,
  Referrer,
  Site,
  SiteDetail,
  SiteTraffic,
  TopPage,
  TrafficPoint,
} from './types.js';

// Export API fetch utility
export { apiFetch } from './api-fetch.js';

// Export client-side data fetchers (these call the API)
export { fetchRecentEvents } from './events.js';
export {
  fetchOverviewMetrics,
  fetchReferrers,
  fetchTopPages,
} from './metrics.js';
export {
  fetchSiteDetail,
  fetchSites,
  fetchSiteTraffic,
  SITES,
} from './sites.js';

// Re-export server-side data functions for server usage
export {
  getOverviewMetrics,
  getReferrers,
  getTopPages,
} from './api-metrics.js';
export { getRecentEvents } from './api-events.js';
export {
  getSiteDetail,
  getSiteTraffic,
  getSites,
  SITES as API_SITES,
} from './api-sites.js';
