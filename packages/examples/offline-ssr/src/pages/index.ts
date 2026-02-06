/**
 * Pages
 *
 * Exports all pages and a componentMap for route-based rendering.
 * Both worker and main thread use the same componentMap.
 */
import type { RefSpec } from '@rimitive/view/types';
import type { PageService } from './types';
import { HomePage } from './HomePage';
import { DetailPage } from './DetailPage';

export type { PageService } from './types';
export { HomePage, type HomePageData } from './HomePage';
export { DetailPage, type DetailPageData } from './DetailPage';

/**
 * Page component type - all pages follow this signature.
 */
export type PageComponent = (
  svc: PageService
) => (params: Record<string, string>) => Promise<RefSpec<unknown>>;

/**
 * Map route IDs to page components.
 */
export const componentMap: Record<string, PageComponent> = {
  home: (svc) => () => HomePage(svc),
  detail: (svc) => (params) => DetailPage(svc)({ id: params.id ?? '' }),
};

/**
 * Render a route using the componentMap.
 */
export async function renderPage(
  svc: PageService,
  routeId: string,
  params: Record<string, string>
): Promise<RefSpec<unknown> | null> {
  const Component = componentMap[routeId];
  if (!Component) return null;
  return Component(svc)(params);
}
