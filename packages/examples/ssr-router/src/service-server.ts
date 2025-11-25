/**
 * Server-only service factory
 *
 * Creates per-request services for SSR. This module imports SSR-only
 * dependencies and should never be bundled for the client.
 */
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createAddEventListener } from '@lattice/view/helpers/addEventListener';
import { createRouter, ViewApi } from '@lattice/router';
import { createIslandSSRApi } from '@lattice/islands/presets/island-ssr';
import { RefSpec, RendererConfig } from '@lattice/view/types';

type ServiceOptions = {
  /** Initial path for the router (used for SSR with specific request paths) */
  initialPath?: string;
};

/**
 * Create server-side services for a single request
 *
 * Each SSR request should call this to get isolated services.
 */
export const createServices = (options: ServiceOptions = {}) => {
  const signalServices = createSignalsApi();

  // Server: use islandSSRSvc which has its own renderer (linkedom)
  const islandSSRSvc = createIslandSSRApi(signalServices);

  // The islandSSRSvc.api has all the view services we need
  const svc = {
    ...islandSSRSvc.api,
    addEventListener: createAddEventListener(signalServices.batch),
  };

  type MergedService = typeof svc;

  // Cast to ViewApi - the SSR API is compatible but types don't match exactly
  const router = createRouter(svc as unknown as ViewApi<RendererConfig>, {
    initialPath: options.initialPath || '/',
  });

  return {
    service: {
      view: islandSSRSvc.views,
      signals: signalServices,
    },
    router,
    mount: <TElement>(spec: RefSpec<TElement>) => islandSSRSvc.mount(spec),
    useSvc: <TReturn>(fn: (svc: MergedService) => TReturn): TReturn => fn(svc),
    withSvc: <TReturn>(fn: (svc: MergedService) => TReturn) => fn,
  };
};
