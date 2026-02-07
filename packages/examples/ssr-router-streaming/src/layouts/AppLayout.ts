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
import { prefetch } from '../lib/prefetch.js';

export const AppLayout = (svc: Service) => {
  const { el, match, router, lazy } = svc;

  // Prefetch data on client-side navigation (no-ops on server since effects are synchronous)
  const usePrefetch = svc(prefetch);
  const SideNavView = svc(SideNav);
  const NotFoundView = svc(NotFound);

  const OverviewView = lazy(() =>
    import('../pages/Overview.js').then((m) => svc(m.Overview))
  );
  const SiteDetailView = lazy(() =>
    import('../pages/SiteDetail.js').then((m) => svc(m.SiteDetail))
  );
  const FeedView = lazy(() =>
    import('../pages/Feed.js').then((m) => svc(m.Feed))
  );

  return () => {
    usePrefetch();

    return el('div').props({ className: 'app' })(
      SideNavView(),
      el('main').props({ className: 'main-content' })(
        match(router.matches, (matchedRoutes: MatchedRoute[]) => {
          const route = matchedRoutes[0];

          switch (route?.id) {
            case 'overview':
              return OverviewView();
            case 'site-detail':
              return SiteDetailView();
            case 'feed':
              return FeedView();
            default:
              return NotFoundView();
          }
        })
      )
    );
  };
};
