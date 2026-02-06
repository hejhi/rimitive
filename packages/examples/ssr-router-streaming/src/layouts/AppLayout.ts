/**
 * App Layout
 *
 * Dashboard layout with sidebar navigation and route content.
 * Pages with load() boundaries are lazy-loaded so that
 * renderToStream discovers their async boundaries correctly.
 */
import type { MatchedRoute } from '@rimitive/router';
import type { Service } from '../service.js';
import { SideNav } from '../components/SideNav.js';
import { NotFound } from '../pages/NotFound.js';

export const AppLayout = (svc: Service) => {
  const { el, match, router, lazy } = svc;

  return el('div').props({ className: 'app' })(
    SideNav(svc)(),
    el('main').props({ className: 'main-content' })(
      match(router.matches, (matchedRoutes: MatchedRoute[]) => {
        const route = matchedRoutes[0];
        if (!route) return svc(NotFound)();

        if (route.id === 'overview') {
          return lazy(() =>
            import('../pages/Overview.js').then((m) => m.Overview(svc))
          )();
        }
        if (route.id === 'site-detail') {
          return lazy(() =>
            import('../pages/SiteDetail.js').then((m) => m.SiteDetail(svc))
          )();
        }
        if (route.id === 'feed') {
          return lazy(() =>
            import('../pages/Feed.js').then((m) => m.Feed(svc))
          )();
        }

        return svc(NotFound)();
      })
    )
  );
};
