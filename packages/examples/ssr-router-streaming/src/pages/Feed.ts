/**
 * Feed Page — Single boundary + interactive island
 *
 * Demonstrates streaming SSR with client interactivity. One load() boundary
 * fetches events, then the EventFilter component provides reactive filtering
 * after hydration. The map() over filteredEvents updates reactively when
 * the user clicks a filter button post-hydration.
 */
import type { LoadState } from '@rimitive/view/load';
import type { RefSpec } from '@rimitive/view/types';
import type { AnalyticsEvent } from '../data/types.js';
import type { Service } from '../service.js';
import { fetchRecentEvents } from '../data/index.js';
import { renderBoundary } from '../ssr/streaming.js';
import { EventRow, EventFilter, SkeletonCard } from '../components/index.js';

export const Feed = (svc: Service) => {
  const { el, loader, match, signal, computed, map } = svc;
  const skeleton = SkeletonCard(svc);
  const eventRow = EventRow(svc);
  const eventFilter = EventFilter(svc);

  const feedEvents = loader.load(
    'feed-events',
    () => fetchRecentEvents(),
    (state: LoadState<AnalyticsEvent[]>) =>
      renderBoundary(match, state, {
        pending: () => skeleton({ size: 'lg' }),
        error: (err) =>
          el('div').props({ className: 'section-error' })(String(err)),
        ready: (events) => {
          const allEvents = signal(events);
          const activeFilter = signal<string>('all');
          const filteredEvents = computed(() =>
            activeFilter() === 'all'
              ? allEvents()
              : allEvents().filter((e) => e.type === activeFilter())
          );
          const handleFilter = (type: string) => activeFilter(type);

          return el('div').props({ className: 'feed-content' })(
            eventFilter({
              events: allEvents,
              activeFilter,
              onFilter: handleFilter,
            }),
            el('div').props({ className: 'events-list' })(
              map(
                filteredEvents,
                (e: AnalyticsEvent) => e.id,
                (eventSignal) => eventRow({ event: eventSignal() })
              )
            )
          );
        },
      }),
    { eager: true }
  );

  return (): RefSpec<HTMLElement> =>
    el('div').props({ className: 'page feed-page' })(
      el('h2')('Live Feed'),
      feedEvents
    );
};
