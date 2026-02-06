/**
 * Data-only rendering for SSR.
 *
 * Mounts a spec and resolves all async fragments to collect data
 * without producing HTML. Useful for data-only endpoints.
 */

import type { RefSpec } from '@rimitive/view/types';
import type { NodeRef } from '@rimitive/view/types';
import { resolveAllAsyncFragments } from './resolve-fragments';

/**
 * Options for renderToData
 */
export type RenderToDataOptions = {
  /** Mount function to create NodeRef from RefSpec */
  mount: (spec: RefSpec<unknown>) => NodeRef<unknown>;
  /** Function that returns all collected loader data */
  getData: () => Record<string, unknown>;
};

/**
 * Render a spec to collect data without producing HTML.
 *
 * Mounts the spec, resolves all async fragments (load() boundaries),
 * then returns the collected data via getData(). Useful for data-only
 * endpoints like `/_data/:path` that serve prefetch JSON.
 *
 * @example
 * ```ts
 * const data = await renderToData(AppLayout(service), {
 *   mount: (spec) => spec.create(service),
 *   getData: () => service.loader.getData(),
 * });
 * // data = { 'user-1': { name: 'Alice' }, 'stats': { ... } }
 * ```
 */
export async function renderToData(
  spec: RefSpec<unknown>,
  options: RenderToDataOptions
): Promise<Record<string, unknown>> {
  const { mount, getData } = options;
  const nodeRef = mount(spec);
  await resolveAllAsyncFragments(nodeRef);
  return getData();
}
