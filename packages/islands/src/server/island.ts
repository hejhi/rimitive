/**
 * Pre-configured Island Factory
 *
 * For the common case where no custom context is needed.
 * Simply import and use:
 *
 * ```ts
 * import { island } from '@lattice/islands/server';
 *
 * export const Counter = island('counter', (svc, getContext) => ({ count }: Props) => {
 *   // svc is typed as IslandSvc
 *   return svc.el('div')(...);
 * });
 * ```
 *
 * For custom context, use createIsland from '@lattice/islands/factory':
 *
 * ```ts
 * import { createIsland } from '@lattice/islands/factory';
 * import type { IslandSvc } from '@lattice/islands/server';
 *
 * type MyContext = { user: User };
 * const island = createIsland<IslandSvc, MyContext>();
 * ```
 */

import { createIsland } from '../factory';
import type { IslandSvc } from '../presets/islands.server';

/**
 * Pre-configured island factory with IslandSvc types baked in.
 *
 * Props are inferred from the factory function's parameter annotation.
 *
 * @example
 * ```typescript
 * import { island } from '@lattice/islands/server';
 *
 * export const Counter = island('counter', (svc, getContext) => ({ count }: { count: number }) => {
 *   const value = svc.signal(count);
 *   return svc.el('button').props({ onclick: () => value(value() + 1) })(value);
 * });
 * ```
 */
export const island = createIsland<IslandSvc>();
