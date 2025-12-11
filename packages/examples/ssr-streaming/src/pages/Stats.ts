/**
 * Stats Page - Demonstrates streaming SSR with multiple load() boundaries
 *
 * This page has THREE async boundaries with staggered delays to demonstrate
 * true streaming: each section appears as its data arrives, not all at once.
 */
import type { LoadState, LoadStatus } from '@lattice/view/load';
import type { RefSpec } from '@lattice/view/types';
import type { Service } from '../service.js';

// =============================================================================
// Data Types
// =============================================================================

type QuickStats = {
  totalUsers: number;
  activeUsers: number;
  pageViews: number;
  avgSessionDuration: string;
};

type TopPagesData = {
  topPages: Array<{ path: string; views: number }>;
};

type RecentActivity = {
  events: Array<{ type: string; user: string; time: string }>;
};

// =============================================================================
// Simulated API Fetchers (with staggered delays to demonstrate streaming)
// =============================================================================

/** Fast: 500ms - Basic stats */
async function fetchQuickStats(): Promise<QuickStats> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    totalUsers: 12_453,
    activeUsers: 842,
    pageViews: 156_789,
    avgSessionDuration: '4m 32s',
  };
}

/** Medium: 1200ms - Top pages */
async function fetchTopPages(): Promise<TopPagesData> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  return {
    topPages: [
      { path: '/products', views: 45_230 },
      { path: '/about', views: 23_456 },
      { path: '/', views: 18_902 },
      { path: '/products/1', views: 12_345 },
    ],
  };
}

/** Slow: 2000ms - Recent activity */
async function fetchRecentActivity(): Promise<RecentActivity> {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return {
    events: [
      { type: 'signup', user: 'alice@example.com', time: '2 min ago' },
      { type: 'purchase', user: 'bob@example.com', time: '5 min ago' },
      { type: 'signup', user: 'carol@example.com', time: '8 min ago' },
      { type: 'review', user: 'dan@example.com', time: '12 min ago' },
    ],
  };
}

// =============================================================================
// Section Components
// =============================================================================

/** Quick stats grid - renders when data arrives (~500ms) */
const QuickStatsContent = (
  { el }: Service,
  stats: QuickStats
): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'stats-grid' })(
    el('div').props({ className: 'stat-card' })(
      el('div').props({ className: 'stat-value' })(
        stats.totalUsers.toLocaleString()
      ),
      el('div').props({ className: 'stat-label' })('Total Users')
    ),
    el('div').props({ className: 'stat-card' })(
      el('div').props({ className: 'stat-value' })(
        stats.activeUsers.toLocaleString()
      ),
      el('div').props({ className: 'stat-label' })('Active Now')
    ),
    el('div').props({ className: 'stat-card' })(
      el('div').props({ className: 'stat-value' })(
        stats.pageViews.toLocaleString()
      ),
      el('div').props({ className: 'stat-label' })('Page Views')
    ),
    el('div').props({ className: 'stat-card' })(
      el('div').props({ className: 'stat-value' })(stats.avgSessionDuration),
      el('div').props({ className: 'stat-label' })('Avg Session')
    )
  );

const QuickStatsLoading = ({ el }: Service): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'stats-grid' })(
    ...[1, 2, 3, 4].map(() =>
      el('div').props({ className: 'stat-card skeleton' })(
        el('div').props({ className: 'stat-value' })('...'),
        el('div').props({ className: 'stat-label' })('Loading')
      )
    )
  );

/** Top pages section - renders when data arrives (~1200ms) */
const TopPagesContent = (
  { el }: Service,
  data: TopPagesData
): RefSpec<HTMLElement> =>
  el('section').props({ className: 'top-pages-section' })(
    el('h3')('Top Pages'),
    el('div').props({ className: 'top-pages-list' })(
      ...data.topPages.map((page) =>
        el('div').props({ className: 'top-page-item' })(
          el('span').props({ className: 'page-path' })(page.path),
          el('span').props({ className: 'page-views' })(
            page.views.toLocaleString() + ' views'
          )
        )
      )
    )
  );

const TopPagesLoading = ({ el }: Service): RefSpec<HTMLElement> =>
  el('section').props({ className: 'top-pages-section' })(
    el('h3')('Top Pages'),
    el('div').props({ className: 'top-pages-list loading' })(
      ...[1, 2, 3, 4].map(() =>
        el('div').props({ className: 'top-page-item' })(
          el('span').props({ className: 'page-path' })('...'),
          el('span').props({ className: 'page-views' })('loading')
        )
      )
    )
  );

/** Recent activity - renders when data arrives (~2000ms) */
const RecentActivityContent = (
  { el }: Service,
  data: RecentActivity
): RefSpec<HTMLElement> =>
  el('section').props({ className: 'activity-section card' })(
    el('h3')('Recent Activity'),
    el('div').props({ className: 'activity-list' })(
      ...data.events.map((event) =>
        el('div').props({ className: 'activity-item' })(
          el('span').props({ className: 'activity-type' })(event.type),
          el('span').props({ className: 'activity-user' })(event.user),
          el('span').props({ className: 'activity-time' })(event.time)
        )
      )
    )
  );

const RecentActivityLoading = ({ el }: Service): RefSpec<HTMLElement> =>
  el('section').props({ className: 'activity-section card' })(
    el('h3')('Recent Activity'),
    el('div').props({ className: 'activity-list loading' })(
      el('p')('Loading recent activity...')
    )
  );

/** Error display for any section */
const SectionError = (
  { el }: Service,
  title: string,
  error: unknown
): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'section-error' })(
    el('h3')(title),
    el('p').props({ className: 'error-text' })(
      error instanceof Error ? error.message : String(error)
    )
  );

// =============================================================================
// Main Stats Page
// =============================================================================

/**
 * Stats Page - demonstrates TRUE streaming with multiple load() boundaries
 *
 * Watch the console and the page - you'll see:
 * 1. Shell appears immediately
 * 2. Quick stats appear at ~500ms
 * 3. Top pages appear at ~1200ms
 * 4. Recent activity appears at ~2000ms
 *
 * Each section streams independently as its data resolves!
 */
export const Stats = (svc: Service) => (): RefSpec<HTMLElement> => {
  const { el, load, match } = svc;

  // Three independent load() boundaries with staggered delays
  const quickStats = load(
    'quick-stats',
    () => fetchQuickStats(),
    (state: LoadState<QuickStats>) =>
      match(state.status, (status: LoadStatus) => {
        switch (status) {
          case 'pending':
            return QuickStatsLoading(svc);
          case 'error':
            return SectionError(svc, 'Stats', state.error());
          case 'ready':
            return QuickStatsContent(svc, state.data()!);
        }
      })
  );

  const topPages = load(
    'top-pages',
    () => fetchTopPages(),
    (state: LoadState<TopPagesData>) =>
      match(state.status, (status: LoadStatus) => {
        switch (status) {
          case 'pending':
            return TopPagesLoading(svc);
          case 'error':
            return SectionError(svc, 'Top Pages', state.error());
          case 'ready':
            return TopPagesContent(svc, state.data()!);
        }
      })
  );

  const recentActivity = load(
    'recent-activity',
    () => fetchRecentActivity(),
    (state: LoadState<RecentActivity>) =>
      match(state.status, (status: LoadStatus) => {
        switch (status) {
          case 'pending':
            return RecentActivityLoading(svc);
          case 'error':
            return SectionError(svc, 'Recent Activity', state.error());
          case 'ready':
            return RecentActivityContent(svc, state.data()!);
        }
      })
  );

  return el('div').props({ className: 'page stats-page' })(
    el('h2')('Dashboard Stats'),

    el('p').props({ className: 'lead' })(
      'This page has THREE async boundaries with staggered delays. '
    ),

    // Three independent streaming sections
    quickStats,
    topPages,
    recentActivity,

    // How it works (static, renders immediately)
    el('section').props({ className: 'card' })(
      el('h3')('How Streaming SSR Works'),
      el('p')(
        'Each section above is a separate load() boundary. They stream independently:'
      ),
      el('ul')(
        el('li')('Quick Stats: ~500ms'),
        el('li')('Top Pages: ~1200ms'),
        el('li')('Recent Activity: ~2000ms')
      ),
      el('p')(
        'With true streaming, data chunks are sent to the browser AS they resolve, '
      )
    )
  );
};
