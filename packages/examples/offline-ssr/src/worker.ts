/**
 * Pre-rendering Worker
 *
 * Renders pages to HTML in a Web Worker using the parse5 adapter.
 * Uses Comlink for RPC communication with the main thread.
 */

import * as Comlink from 'comlink';
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { ElModule } from '@rimitive/view/el';
import { MapModule } from '@rimitive/view/map';
import { createParse5Adapter, renderToString } from '@rimitive/ssr/server';
import { RouterModule } from '@rimitive/router';

import { DataCacheModule } from './lib/cache';
import { ActionsModule } from './actions';
import { routes } from './routes';
import { renderPage } from './pages/index';
import type { WorkerApi } from './worker-api';

function createWorkerService(initialPath: string) {
  const { adapter, serialize } = createParse5Adapter();
  const svc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    ElModule.with({ adapter }),
    MapModule.with({ adapter }),
    RouterModule.with({ routes, initialPath }),
    ActionsModule.with({}),
    DataCacheModule.with({ dbName: 'rimitive-todos-cache' })
  );
  return { svc, serialize };
}

const api: WorkerApi = {
  async prerender(route) {
    const startTime = performance.now();
    const { svc, serialize } = createWorkerService(route);
    const match = svc.router.matches()[0];

    if (!match) throw new Error(`Route not found: ${route}`);

    const spec = await renderPage(svc, match.id, match.params);
    if (!spec) throw new Error(`No component for route: ${route}`);

    return {
      html: renderToString(spec.create(svc), serialize),
      renderTime: performance.now() - startTime,
    };
  },

  async invalidate(route) {
    const { svc } = createWorkerService(route);
    await svc.cache.delete(route);
    return api.prerender(route);
  },
};

Comlink.expose(api);
