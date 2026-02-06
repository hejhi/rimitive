/**
 * Worker API Types
 *
 * Shared types for worker RPC communication.
 */

export type PrerenderResult = {
  html: string;
  renderTime: number;
};

export type WorkerApi = {
  prerender(route: string): Promise<PrerenderResult>;
  invalidate(route: string): Promise<PrerenderResult>;
};
