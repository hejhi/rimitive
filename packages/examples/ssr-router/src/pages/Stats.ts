/**
 * Stats Page - Demonstrates async data loading with load()
 *
 * This page uses @lattice/view's load() with the fetcher/renderer pattern.
 * The renderer receives a state object with reactive properties (status, data, error)
 * and uses match() to reactively switch between states.
 *
 * During SSR, the data is fetched and rendered to HTML with ready state.
 * During client hydration, the data is extracted from markers (no re-fetch).
 * On subsequent client navigations, data is fetched fresh (pending → ready).
 */
import type { LoadState, LoadStatus } from '@lattice/view/load';
import type { RefSpec } from '@lattice/view/types';
import type { Service } from '../service.js';

/**
 * Simulated stats data type
 */
type StatsData = {
  totalUsers: number;
  activeUsers: number;
  pageViews: number;
  avgSessionDuration: string;
  topPages: Array<{ path: string; views: number }>;
  fetchedAt: string;
};

/**
 * Simulate fetching stats from an API
 * In a real app, this would be a fetch() call
 */
async function fetchStats(): Promise<StatsData> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    totalUsers: 12_453,
    activeUsers: 842,
    pageViews: 156_789,
    avgSessionDuration: '4m 32s',
    topPages: [
      { path: '/products', views: 45_230 },
      { path: '/about', views: 23_456 },
      { path: '/', views: 18_902 },
      { path: '/products/1', views: 12_345 },
    ],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Stats content component - renders the actual stats UI
 */
const StatsContent = (
  { el }: Service,
  stats: StatsData
): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'page stats-page' })(
    el('h2')('Dashboard Stats'),

    el('p').props({ className: 'lead' })(
      'This page demonstrates async data loading with load(). The stats below were fetched during SSR and hydrated on the client.'
    ),

    // Stats grid
    el('div').props({ className: 'stats-grid' })(
      // Total Users
      el('div').props({ className: 'stat-card' })(
        el('div').props({ className: 'stat-value' })(
          stats.totalUsers.toLocaleString()
        ),
        el('div').props({ className: 'stat-label' })('Total Users')
      ),

      // Active Users
      el('div').props({ className: 'stat-card' })(
        el('div').props({ className: 'stat-value' })(
          stats.activeUsers.toLocaleString()
        ),
        el('div').props({ className: 'stat-label' })('Active Now')
      ),

      // Page Views
      el('div').props({ className: 'stat-card' })(
        el('div').props({ className: 'stat-value' })(
          stats.pageViews.toLocaleString()
        ),
        el('div').props({ className: 'stat-label' })('Page Views')
      ),

      // Avg Session
      el('div').props({ className: 'stat-card' })(
        el('div').props({ className: 'stat-value' })(stats.avgSessionDuration),
        el('div').props({ className: 'stat-label' })('Avg Session')
      )
    ),

    // Top Pages section
    el('section').props({ className: 'top-pages-section' })(
      el('h3')('Top Pages'),
      el('div').props({ className: 'top-pages-list' })(
        ...stats.topPages.map((page) =>
          el('div').props({ className: 'top-page-item' })(
            el('span').props({ className: 'page-path' })(page.path),
            el('span').props({ className: 'page-views' })(
              page.views.toLocaleString() + ' views'
            )
          )
        )
      )
    ),

    // How it works section
    el('section').props({ className: 'card' })(
      el('h3')('How load() Works'),
      el('p')(
        'The load() function creates an async boundary with a fetcher/renderer pattern:'
      ),
      el('ol')(
        el('li')('load(fetcher, renderer) is called - renderer uses match() on state.status'),
        el('li')('SSR awaits the fetcher and renders with ready state'),
        el('li')(
          'Hydration data is embedded in fragment markers (base64 JSON)'
        ),
        el('li')('Client hydration extracts data from markers - no re-fetch'),
        el('li')(
          'Client navigation shows pending state while fetching fresh data'
        )
      )
    ),

    // Metadata
    el('div').props({ className: 'stats-meta' })(
      el('small')('Data fetched at: ' + stats.fetchedAt)
    )
  );

/**
 * Loading state component
 */
const StatsLoading = ({ el }: Service): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'page stats-page loading' })(
    el('h2')('Dashboard Stats'),
    el('div').props({ className: 'stats-grid' })(
      ...[1, 2, 3, 4].map(() =>
        el('div').props({ className: 'stat-card skeleton' })(
          el('div').props({ className: 'stat-value' })('...'),
          el('div').props({ className: 'stat-label' })('Loading')
        )
      )
    )
  );

/**
 * Error state component
 */
const StatsError = ({ el }: Service, error: unknown): RefSpec<HTMLDivElement> =>
  el('div').props({ className: 'page stats-page error' })(
    el('h2')('Dashboard Stats'),
    el('div').props({ className: 'error-message' })(
      el('p')('Failed to load stats'),
      el('pre')(error instanceof Error ? error.message : String(error))
    )
  );

/**
 * Stats Page - uses load() for async data fetching with fetcher/renderer pattern
 *
 * This demonstrates the load() API:
 * - Renderer receives state object with reactive properties (status, data, error)
 * - Uses match() on state.status to reactively switch between states
 * - SSR: awaits fetcher, renders with ready state, embeds data in markers
 * - Client hydration: extracts data from markers (no re-fetch)
 * - Client navigation: shows pending, fetches fresh, then ready
 */
export const Stats = (svc: Service) => (): RefSpec<HTMLElement> => {
  const { load, match } = svc;

  return load(
    () => fetchStats(),
    (state: LoadState<StatsData>) =>
      match(state.status, (status: LoadStatus) => {
        switch (status) {
          case 'pending':
            return StatsLoading(svc);
          case 'error':
            return StatsError(svc, state.error());
          case 'ready':
            return StatsContent(svc, state.data()!);
        }
      })
  );
};
