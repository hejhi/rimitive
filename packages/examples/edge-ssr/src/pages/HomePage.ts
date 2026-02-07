/**
 * Home Page - Basic SSR demonstration
 */
import type { RefSpec } from '@rimitive/view/types';
import type { Service } from '../service.js';

export const HomePage = (svc: Service) => (): RefSpec<HTMLDivElement> => {
  const { el } = svc;

  const div = el('div');
  const p = el('p');
  const li = el('li');

  return div.props({ class: 'page home-page' })(
    el('h1')('Rimitive Edge SSR'),
    p.props({ class: 'lead' })('Full SSR running on Cloudflare Workers.'),
    p(`Rendered at: ${new Date().toISOString()}`),

    div.props({ class: 'card' })(
      el('h3')('What This Proves'),
      el('ul')(
        li('Parse5 adapter works in Workers runtime'),
        li('Same components render on edge and client'),
        li('Zero Node.js dependencies'),
        li('Streaming SSR with async boundaries'),
        li('Client-side hydration and navigation')
      )
    ),

    p(el('a').props({ href: '/streaming' })('Try the streaming demo →'))
  );
};
