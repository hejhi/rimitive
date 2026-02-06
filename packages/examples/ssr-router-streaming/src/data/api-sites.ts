import type {
  AnalyticsEvent,
  Site,
  SiteDetail,
  SiteTraffic,
  TrafficPoint,
} from './types.js';

export const SITES: Site[] = [
  {
    id: 'site-1',
    name: 'Marketing Site',
    domain: 'acme.com',
    color: '#6366f1',
  },
  {
    id: 'site-2',
    name: 'Developer Docs',
    domain: 'docs.acme.com',
    color: '#10b981',
  },
  { id: 'site-3', name: 'Blog', domain: 'blog.acme.com', color: '#f59e0b' },
];

export async function getSites(): Promise<Site[]> {
  return Promise.resolve(SITES);
}

export async function getSiteDetail(id: string): Promise<SiteDetail> {
  const site = SITES.find((s) => s.id === id) ?? SITES[0];
  return {
    site,
    totalVisitors: 142_350,
    todayVisitors: 3_821,
  };
}

function generateTrafficPoints(): TrafficPoint[] {
  const points: TrafficPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const hour = `${h.toString().padStart(2, '0')}:00`;
    const base = h >= 9 && h <= 17 ? 400 : 120;
    const peak = h >= 11 && h <= 14 ? 200 : 0;
    const visitors = base + peak + Math.floor(Math.random() * 80);
    points.push({ hour, visitors });
  }
  return points;
}

function generateRecentEvents(siteId: string): AnalyticsEvent[] {
  const types: AnalyticsEvent['type'][] = [
    'pageview',
    'signup',
    'purchase',
    'error',
  ];
  const paths = ['/home', '/pricing', '/docs', '/blog/new-release', '/contact'];
  const events: AnalyticsEvent[] = [];
  for (let i = 0; i < 5; i++) {
    events.push({
      id: `${siteId}-evt-${i}`,
      type: types[i % types.length],
      path: paths[i % types.length],
      visitor: `visitor-${String(Math.floor(Math.random() * 50) + 1).padStart(3, '0')}`,
      timestamp: `${(i + 1) * 3}m ago`,
    });
  }
  return events;
}

export async function getSiteTraffic(siteId: string): Promise<SiteTraffic> {
  return {
    points: generateTrafficPoints(),
    recentEvents: generateRecentEvents(siteId),
  };
}
