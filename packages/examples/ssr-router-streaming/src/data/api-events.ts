import type { AnalyticsEvent } from './types.js';

const EVENT_TYPES: AnalyticsEvent['type'][] = [
  'pageview',
  'signup',
  'purchase',
  'error',
];

const PATHS = [
  '/products',
  '/pricing',
  '/docs/getting-started',
  '/blog/announcing-v2',
  '/contact',
  '/docs/api-reference',
  '/signup',
  '/dashboard',
  '/settings',
  '/checkout',
];

function generateEvents(count: number): AnalyticsEvent[] {
  const events: AnalyticsEvent[] = [];
  for (let i = 0; i < count; i++) {
    const minutesAgo = Math.floor((i / count) * 45) + 2;
    events.push({
      id: `evt-${String(i + 1).padStart(3, '0')}`,
      type: EVENT_TYPES[i % EVENT_TYPES.length],
      path: PATHS[i % PATHS.length],
      visitor: `visitor-${String(Math.floor(Math.random() * 50) + 1).padStart(3, '0')}`,
      timestamp: `${minutesAgo}m ago`,
    });
  }
  return events;
}

export async function getRecentEvents(limit = 20): Promise<AnalyticsEvent[]> {
  return generateEvents(limit);
}
