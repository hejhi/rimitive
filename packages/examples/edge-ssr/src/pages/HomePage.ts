/**
 * Home Page - Basic SSR demonstration
 */
import type { RefSpec } from '@rimitive/view/types';
import type { Service } from '../service.js';

export const HomePage = (svc: Service) => (): RefSpec<HTMLDivElement> => {
  const { el } = svc;

  return el('div').props({ class: 'page home-page' })(
    el('h1')('Rimitive Edge SSR'),
    el('p').props({ class: 'lead' })(
      'Full SSR running on Cloudflare Workers.'
    ),
    el('p')(`Rendered at: ${new Date().toISOString()}`),

    el('div').props({ class: 'card' })(
      el('h3')('What This Proves'),
      el('ul')(
        el('li')('Parse5 adapter works in Workers runtime'),
        el('li')('Same components render on edge and client'),
        el('li')('Zero Node.js dependencies'),
        el('li')('Streaming SSR with async boundaries'),
        el('li')('Client-side hydration and navigation')
      )
    ),

    el('p')(
      el('a').props({ href: '/streaming' })('Try the streaming demo →')
    )
  );
};
