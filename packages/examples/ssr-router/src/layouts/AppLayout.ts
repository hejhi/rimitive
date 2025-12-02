import { connect, type ConnectedApi } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import { Navigation } from '../islands/Navigation.js';

export const AppLayout = connect(
  ({ el }: ConnectedApi<DOMRendererConfig>, { children }) =>
    () => {
      return el('div').props({ className: 'app' })(
        el('nav').props({ className: 'navbar' })(
          el('div').props({ className: 'nav-brand' })(
            el('h1')('🧩 Lattice SSR + Router')
          ),
          Navigation({})
        ),
        el('main').props({ className: 'main-content' })(...(children || []))
      );
    }
);
