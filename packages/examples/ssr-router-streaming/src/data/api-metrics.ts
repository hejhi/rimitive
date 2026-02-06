import type { OverviewMetrics, Referrer, TopPage } from './types.js';

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  return {
    visitors: 24_521,
    visitorsChange: 12.3,
    events: 89_432,
    eventsChange: -2.1,
    pageViews: 156_789,
    pageViewsChange: 8.7,
    bounceRate: 34.2,
    bounceRateChange: -1.5,
  };
}

export async function getTopPages(): Promise<TopPage[]> {
  return [
    { path: '/', views: 45_230, uniqueVisitors: 32_100 },
    { path: '/pricing', views: 12_450, uniqueVisitors: 9_800 },
    { path: '/docs/getting-started', views: 8_320, uniqueVisitors: 6_540 },
    { path: '/blog/announcing-v2', views: 6_100, uniqueVisitors: 5_200 },
    { path: '/contact', views: 3_890, uniqueVisitors: 3_100 },
    { path: '/docs/api-reference', views: 2_760, uniqueVisitors: 2_300 },
  ];
}

export async function getReferrers(): Promise<Referrer[]> {
  return [
    { source: 'Google', visitors: 12_340, trend: 'up' },
    { source: 'Twitter', visitors: 4_560, trend: 'down' },
    { source: 'GitHub', visitors: 3_210, trend: 'up' },
    { source: 'Direct', visitors: 2_890, trend: 'flat' },
    { source: 'Newsletter', visitors: 1_520, trend: 'up' },
  ];
}
