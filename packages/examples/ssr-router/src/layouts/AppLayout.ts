import { connect, type ConnectedApi } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import { Navigation } from '../islands/Navigation.js';

export const AppLayout = connect(
  (api: ConnectedApi<DOMRendererConfig>, { children }) =>
    () => {
      return api.el('div', { className: 'app' })(
        api.el('nav', { className: 'navbar' })(
          api.el('div', { className: 'nav-brand' })(
            api.el('h1')('🧩 Lattice SSR + Router')
          ),
          Navigation({ currentPath: api.currentPath() })
        ),
        api.el('main', { className: 'main-content' })(...(children || []))
      );
    }
);
