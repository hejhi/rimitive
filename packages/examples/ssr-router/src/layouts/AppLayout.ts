import { connect, type RouteContext } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { api } from '../service.js';
import { Navigation } from '../islands/Navigation.js';

export const AppLayout = connect(
  api((svc, routeCtx: RouteContext<DOMAdapterConfig>) => () => {
    const { el } = svc;
    const { children } = routeCtx;
    return el('div').props({ className: 'app' })(
      el('nav').props({ className: 'navbar' })(
        el('div').props({ className: 'nav-brand' })(
          el('h1')('🧩 Lattice SSR + Router')
        ),
        Navigation({})
      ),
      el('main').props({ className: 'main-content' })(...(children || []))
    );
  })
);
