/**
 * Site Detail Page — Nested dependent loading
 *
 * Demonstrates cascading streaming SSR where an outer load() fetches site info
 * eagerly (~400ms), then an inner load() fetches traffic data that depends on
 * the site ID (deferred, ~900ms after site loads).
 */
import type { LoadState } from '@rimitive/view/load';
import type { RefSpec } from '@rimitive/view/types';
import type { SiteDetail as SiteDetailData, SiteTraffic } from '../data/types.js';
import type { Service } from '../service.js';
import { fetchSiteDetail, fetchSiteTraffic } from '../data/index.js';
import { renderBoundary } from '../ssr/streaming.js';
import { TrafficChart, EventRow, SkeletonCard } from '../components/index.js';

export const SiteDetail = (svc: Service) => {
  const { el, loader, match, router } = svc;
  const skeleton = SkeletonCard(svc);
  const eventRow = EventRow(svc);

  const siteId = router.matches()[0]?.params.id ?? 'site-1';

  const siteDetail = loader.load(
    'site-detail-' + siteId,
    () => fetchSiteDetail(siteId),
    (state: LoadState<SiteDetailData>) =>
      renderBoundary(match, state, {
        pending: () => skeleton({ size: 'md' }),
        error: (err) =>
          el('div').props({ className: 'section-error' })(String(err)),
        ready: (data) =>
          el('div').props({ className: 'site-detail-content' })(
            el('div').props({ className: 'site-header' })(
              el('h3')(data.site.name),
              el('p').props({ className: 'site-domain' })(data.site.domain),
              el('div').props({ className: 'site-stats' })(
                el('span').props({ className: 'stat' })(
                  `${data.totalVisitors.toLocaleString()} total visitors`
                ),
                el('span').props({ className: 'stat' })(
                  `${data.todayVisitors.toLocaleString()} today`
                )
              )
            ),

            // Inner load: fetch traffic data — deferred because it depends on site ID
            loader.load(
              'site-traffic-' + siteId,
              () => fetchSiteTraffic(siteId),
              (trafficState: LoadState<SiteTraffic>) =>
                renderBoundary(match, trafficState, {
                  pending: () => skeleton({ size: 'lg' }),
                  error: (err) =>
                    el('div').props({ className: 'section-error' })(
                      String(err)
                    ),
                  ready: (traffic) =>
                    el('div').props({ className: 'site-traffic' })(
                      TrafficChart(svc)({
                        points: traffic.points,
                        color: data.site.color,
                      }),
                      el('section').props({ className: 'recent-events' })(
                        el('h3')('Recent Events'),
                        ...traffic.recentEvents.map((event) =>
                          eventRow({ event })
                        )
                      )
                    ),
                })
            )
          ),
      }),
    { eager: true }
  );

  return (): RefSpec<HTMLElement> =>
    el('div').props({ className: 'page site-detail-page' })(siteDetail);
};
