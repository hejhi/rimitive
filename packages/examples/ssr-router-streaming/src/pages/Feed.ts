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
import { renderBoundary } from '../lib/streaming.js';
import { EventRow, EventFilter, SkeletonCard } from '../components/index.js';

export const Feed = (svc: Service) => {
  const { el, loader, match, signal, computed, map } = svc;
  const skeleton = svc(SkeletonCard);
  const eventRow = svc(EventRow);
  const eventFilter = svc(EventFilter);
  const div = el('div');

  const feedEvents = loader.load(
    'feed-events',
    () => fetchRecentEvents(),
    (state: LoadState<AnalyticsEvent[]>) =>
      renderBoundary(match, state, {
        pending: () => skeleton({ size: 'lg' }),
        error: (err) => div.props({ className: 'section-error' })(String(err)),
        ready: (events) => {
          const allEvents = signal(events);
          const activeFilter = signal<string>('all');
          const filteredEvents = computed(() =>
            activeFilter() === 'all'
              ? allEvents()
              : allEvents().filter((e) => e.type === activeFilter())
          );
          const handleFilter = (type: string) => activeFilter(type);

          return div.props({ className: 'feed-content' })(
            eventFilter({
              events: allEvents,
              activeFilter,
              onFilter: handleFilter,
            }),
            div.props({ className: 'events-list' })(
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
    div.props({ className: 'page feed-page' })(
      el('h2')('Live Feed'),
      feedEvents
    );
};
