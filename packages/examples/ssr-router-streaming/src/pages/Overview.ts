/**
 * Overview Page — Parallel eager loading with 4 independent load() boundaries
 *
 * Demonstrates streaming SSR where all fetchers fire simultaneously when the
 * lazy chunk loads. Data streams in as each resolves:
 * - Metrics at ~300ms
 * - Top Pages at ~800ms
 * - Referrers at ~1200ms
 */
import type { LoadState } from '@rimitive/view/load';
import type { RefSpec } from '@rimitive/view/types';
import type { OverviewMetrics, TopPage, Referrer } from '../data/types.js';
import type { Service } from '../service.js';
import {
  fetchOverviewMetrics,
  fetchTopPages,
  fetchReferrers,
} from '../data/index.js';
import { renderBoundary } from '../lib/streaming.js';
import {
  MetricCard,
  PageViewsTable,
  ReferrerList,
  SkeletonCard,
} from '../components/index.js';

export const Overview = (svc: Service) => {
  const { el, loader, match } = svc;
  const metricCard = svc(MetricCard);
  const skeleton = svc(SkeletonCard);
  const div = el('div');

  const metrics = loader.load(
    'overview-metrics',
    () => fetchOverviewMetrics(),
    (state: LoadState<OverviewMetrics>) =>
      renderBoundary(match, state, {
        pending: () =>
          div.props({ className: 'metrics-grid' })(
            skeleton({ size: 'sm' }),
            skeleton({ size: 'sm' }),
            skeleton({ size: 'sm' }),
            skeleton({ size: 'sm' })
          ),
        error: (err) => div.props({ className: 'section-error' })(String(err)),
        ready: (data) =>
          div.props({ className: 'metrics-grid' })(
            metricCard({
              label: 'Visitors',
              value: data.visitors.toLocaleString(),
              change: data.visitorsChange,
            }),
            metricCard({
              label: 'Events',
              value: data.events.toLocaleString(),
              change: data.eventsChange,
            }),
            metricCard({
              label: 'Page Views',
              value: data.pageViews.toLocaleString(),
              change: data.pageViewsChange,
            }),
            metricCard({
              label: 'Bounce Rate',
              value: `${data.bounceRate.toFixed(1)}%`,
              change: data.bounceRateChange,
            })
          ),
      }),
    { eager: true }
  );

  const topPages = loader.load(
    'top-pages',
    () => fetchTopPages(),
    (state: LoadState<TopPage[]>) =>
      renderBoundary(match, state, {
        pending: () => skeleton({ size: 'lg' }),
        error: (err) => div.props({ className: 'section-error' })(String(err)),
        ready: (data) => PageViewsTable(svc)({ pages: data }),
      }),
    { eager: true }
  );

  const referrers = loader.load(
    'referrers',
    () => fetchReferrers(),
    (state: LoadState<Referrer[]>) =>
      renderBoundary(match, state, {
        pending: () => skeleton({ size: 'md' }),
        error: (err) => div.props({ className: 'section-error' })(String(err)),
        ready: (data) => ReferrerList(svc)({ referrers: data }),
      }),
    { eager: true }
  );

  return (): RefSpec<HTMLElement> =>
    div.props({ className: 'page overview-page' })(
      el('h2')('Dashboard Overview'),
      metrics,
      div.props({ className: 'overview-grid' })(topPages, referrers)
    );
};
