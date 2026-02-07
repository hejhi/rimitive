/**
 * Main Thread - PWA with Worker Pre-rendering
 *
 * Demonstrates offline-first PWA patterns with Rimitive:
 * - Worker pre-renders pages to HTML via Comlink RPC
 * - Pages use cache() for data - instant on main (already cached)
 * - Hydration attaches interactivity to pre-rendered HTML
 * - View Transitions for native-like navigation
 */

// CSS imported here (not co-located) because workers can't load CSS: https://github.com/vitejs/vite/issues/17570
import './transitions.css';
import './components/ListCard.css';
import './components/TodoItem.css';
import './components/NewListForm.css';
import './components/AddItemForm.css';
import './components/EmptyState.css';
import './pages/DetailPage.css';

import * as Comlink from 'comlink';
import { compose } from '@rimitive/core';
import {
  SignalModule,
  EffectModule,
  ComputedModule,
} from '@rimitive/signals/extend';
import { RouterModule } from '@rimitive/router';

import type { WorkerApi } from './worker-api';
import { routes } from './routes';
import { renderPage } from './pages/index';
import { seedIfEmpty } from './data';
import { ActionsModule } from './actions';

import {
  createHydrateRegion,
  withViewTransition,
  DataCacheModule,
  type Status,
} from './lib';

import PrerenderWorker from './worker?worker';

const app = document.getElementById('app')!;
const statusEl = document.querySelector<HTMLElement>('#status')!;

async function init() {
  const worker = new PrerenderWorker();
  const workerApi = Comlink.wrap<WorkerApi>(worker);

  const svc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    RouterModule.with({
      routes,
      initialPath: window.location.pathname || '/',
    }),
    ActionsModule.with({ workerApi }),
    DataCacheModule.with({ dbName: 'rimitive-todos-cache' })
  );

  const { signal, router, effect } = svc;
  const status = signal<Status>('initializing');

  effect(() => {
    const s = status();
    statusEl.textContent = s.charAt(0).toUpperCase() + s.slice(1);
    statusEl.className = `status ${s}`;
  });

  // Render a page with hydration
  async function render(route: string) {
    // Get pre-rendered HTML from worker
    const { html } = await workerApi.prerender(route);

    // Create hydration region
    const { service, attach } = await createHydrateRegion({
      container: app,
      html,
      service: svc,
    });

    // Get matched route from router
    const matches = service.router.matches();
    const match = matches[0];

    if (match) {
      // Render the page using componentMap - data is already cached by worker
      const spec = await renderPage(service, match.id, match.params);
      if (spec) {
        spec.create(service);
      }
    }

    attach();
  }

  try {
    await seedIfEmpty();
  } catch (error) {
    console.error('[main] Init error:', error);
    status('error');
    return;
  }

  // Handle route changes
  const currentNavigation = signal<string | null>(null);
  const isStale = (route: string) => currentNavigation() !== route;

  async function navigate(
    route: string,
    direction: 'forward' | 'back',
    isInitial: boolean
  ) {
    try {
      if (isStale(route)) return;

      if (isInitial) await render(route);
      else await withViewTransition(direction, () => render(route));

      status('ready');
    } catch (error) {
      if (isStale(route)) return;
      console.error(`[main] Navigation error for ${route}:`, error);
      status('error');
    }
  }

  effect(() => {
    const route = router.pathname();
    if (!route || !isStale(route)) return;
    currentNavigation(route);

    status('loading');
    navigate(route, router.direction(), router.isInitial());
  });
}

init();
