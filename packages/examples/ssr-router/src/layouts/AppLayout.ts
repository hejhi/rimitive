import { connect, type ConnectedApi } from '@lattice/router';
import type { DOMAdapterConfig } from '@lattice/view/adapters/dom';
import { Navigation } from '../islands/Navigation.js';

export const AppLayout = connect(
  ({ el }: ConnectedApi<DOMAdapterConfig>, { children }) =>
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
