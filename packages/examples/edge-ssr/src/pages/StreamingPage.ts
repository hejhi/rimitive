/**
 * Streaming Page - Demonstrates streaming SSR with async boundaries
 */
import type { LoadState, LoadStatus } from '@rimitive/view/load';
import type { Reactive, RefSpec } from '@rimitive/view/types';
import type { Service } from '../service.js';

// =============================================================================
// Data Types & Fetchers
// =============================================================================

type QuickStats = {
  users: number;
  requests: number;
  latency: string;
};

type DetailedStats = {
  topEndpoints: Array<{ path: string; count: number }>;
  errorRate: string;
};

async function fetchQuickStats(): Promise<QuickStats> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    users: 1_234,
    requests: 567_890,
    latency: '12ms',
  };
}

async function fetchDetailedStats(): Promise<DetailedStats> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    topEndpoints: [
      { path: '/api/users', count: 45_000 },
      { path: '/api/posts', count: 32_000 },
      { path: '/api/auth', count: 28_000 },
    ],
    errorRate: '0.02%',
  };
}

type HealthCheck = { status: string; uptime: string };

async function fetchHealthCheck(): Promise<HealthCheck> {
  await new Promise((r) => setTimeout(r, 500));
  throw new Error('Service health endpoint unreachable');
}

// =============================================================================
// Components
// =============================================================================

const QuickStatsCard = (svc: Service, stats: QuickStats) =>
  svc.el('div').props({ class: 'card' })(
    svc.el('h3')('Quick Stats'),
    svc.el('div').props({ class: 'stats-grid' })(
      svc.el('div')(svc.el('strong')(stats.users.toLocaleString()), ' users'),
      svc.el('div')(
        svc.el('strong')(stats.requests.toLocaleString()),
        ' requests'
      ),
      svc.el('div')(svc.el('strong')(stats.latency), ' avg latency')
    )
  );

const DetailedStatsCard = (svc: Service, stats: DetailedStats) =>
  svc.el('div').props({ class: 'card' })(
    svc.el('h3')('Detailed Stats'),
    svc.el('div')(
      svc.el('p')('Error rate: ', svc.el('strong')(stats.errorRate)),
      svc.el('h4')('Top Endpoints'),
      svc.el('ul')(
        ...stats.topEndpoints.map((ep) =>
          svc.el('li')(`${ep.path}: ${ep.count.toLocaleString()} requests`)
        )
      )
    )
  );

const LoadingCard = (svc: Service, title: string) =>
  svc.el('div').props({ class: 'card loading' })(
    svc.el('h3')(title),
    svc.el('div').props({ class: 'skeleton' })('Loading...')
  );

const ErrorFallback = (svc: Service, title: string, error: Reactive<unknown>) =>
  svc.el('div').props({ class: 'card error' })(
    svc.el('h3')(title),
    svc.el('p')('Something went wrong while loading this section.'),
    svc.el('p').props({ class: 'error-detail' })(
      () => error() instanceof Error ? (error() as Error).message : String(error())
    )
  );

// =============================================================================
// Page
// =============================================================================

export const StreamingPage = (svc: Service) => {
  const { el, loader, match, errorBoundary } = svc;

  // Outer closure: declare data needs — fires when code arrives, before render
  const quickStats = loader.load(
    'quick-stats',
    () => fetchQuickStats(),
    (state: LoadState<QuickStats>) =>
      match(state.status, (status: LoadStatus) => {
        switch (status) {
          case 'pending':
            return LoadingCard(svc, 'Quick Stats');
          case 'error':
            return el('div').props({ class: 'card error' })(
              'Error loading stats'
            );
          case 'ready':
            return QuickStatsCard(svc, state.data()!);
        }
      })
  );

  const detailedStats = loader.load(
    'detailed-stats',
    () => fetchDetailedStats(),
    (state: LoadState<DetailedStats>) =>
      match(state.status, (status: LoadStatus) => {
        switch (status) {
          case 'pending':
            return LoadingCard(svc, 'Detailed Stats');
          case 'error':
            return el('div').props({ class: 'card error' })(
              'Error loading details'
            );
          case 'ready':
            return DetailedStatsCard(svc, state.data()!);
        }
      })
  );

  // Error boundary wrapping a load() that will fail — demonstrates graceful
  // error recovery. When fetchHealthCheck rejects, the error boundary catches
  // it and streams the fallback UI instead of silently swallowing the error.
  const healthCheck = errorBoundary(
    loader.load(
      'health-check',
      () => fetchHealthCheck(),
      (state: LoadState<HealthCheck>) =>
        match(state.status, (status: LoadStatus) => {
          switch (status) {
            case 'pending':
              return LoadingCard(svc, 'Health Check');
            case 'error':
              return el('div').props({ class: 'card error' })(
                'Error loading health check'
              );
            case 'ready':
              return el('div').props({ class: 'card' })(
                el('h3')('Health Check'),
                el('p')('Status: ', svc.el('strong')(state.data()!.status)),
                el('p')('Uptime: ', svc.el('strong')(state.data()!.uptime))
              );
          }
        })
    ),
    (error) => ErrorFallback(svc, 'Health Check', error)
  );

  // Inner function: just composes the view
  return (): RefSpec<HTMLDivElement> =>
    el('div').props({ class: 'page streaming-page' })(
      el('h1')('Streaming SSR Demo'),
      el('p').props({ class: 'lead' })(
        'Watch the cards below load progressively as data arrives.'
      ),
      el('p').props({ class: 'timing' })(
        'Quick Stats: ~300ms • Detailed Stats: ~800ms • Health Check: fails!'
      ),

      quickStats,
      detailedStats,
      healthCheck,

      el('div').props({ class: 'card info' })(
        el('h3')('How It Works'),
        el('p')(
          'The shell is sent immediately. Each load() boundary streams its content ',
          'as data resolves. The Health Check above uses an errorBoundary() to ',
          'catch the failing fetch and render a user-friendly fallback.'
        )
      ),

      el('p')(el('a').props({ href: '/' })('← Back to home'))
    );
};
