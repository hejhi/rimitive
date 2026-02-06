export type Site = {
  id: string;
  name: string;
  domain: string;
  color: string;
};

export type OverviewMetrics = {
  visitors: number;
  visitorsChange: number;
  events: number;
  eventsChange: number;
  pageViews: number;
  pageViewsChange: number;
  bounceRate: number;
  bounceRateChange: number;
};

export type TopPage = {
  path: string;
  views: number;
  uniqueVisitors: number;
};

export type Referrer = {
  source: string;
  visitors: number;
  trend: 'up' | 'down' | 'flat';
};

export type AnalyticsEvent = {
  id: string;
  type: 'pageview' | 'signup' | 'purchase' | 'error';
  path: string;
  visitor: string;
  timestamp: string;
};

export type TrafficPoint = {
  hour: string;
  visitors: number;
};

export type SiteDetail = {
  site: Site;
  totalVisitors: number;
  todayVisitors: number;
};

export type SiteTraffic = {
  points: TrafficPoint[];
  recentEvents: AnalyticsEvent[];
};
