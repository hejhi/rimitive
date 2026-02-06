/**
 * Streaming Boundary Helpers
 *
 * Reusable patterns for rendering load() boundaries with streaming SSR.
 * Copy this into your project and customize the loading/error UI.
 */
import type { LoadState, LoadStatus } from '@rimitive/view/load';
import type { Readable } from '@rimitive/signals';
import type { RefSpec } from '@rimitive/view/types';

/**
 * Render a load() boundary with pending/error/ready states.
 * Reduces boilerplate for the common streaming pattern.
 */
export type BoundaryConfig<TData> = {
  pending: () => RefSpec<unknown>;
  error: (err: unknown) => RefSpec<unknown>;
  ready: (data: TData) => RefSpec<unknown>;
};

export function renderBoundary<TData>(
  match: (source: Readable<LoadStatus>, fn: (status: LoadStatus) => RefSpec<unknown>) => RefSpec<unknown>,
  state: LoadState<TData>,
  config: BoundaryConfig<TData>
): RefSpec<unknown> {
  return match(state.status, (status: LoadStatus) => {
    switch (status) {
      case 'pending':
        return config.pending();
      case 'error':
        return config.error(state.error());
      case 'ready':
        return config.ready(state.data()!);
    }
  });
}
