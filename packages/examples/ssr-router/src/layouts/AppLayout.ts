import { connect, type ConnectedApi } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';
import { Navigation } from '../islands/Navigation.js';

export const AppLayout = connect(
  ({ el, currentPath }: ConnectedApi<DOMRendererConfig>, { children }) =>
    () => {
      return el('div', { className: 'app' })(
        el('nav', { className: 'navbar' })(
          el('div', { className: 'nav-brand' })(
            el('h1')('🧩 Lattice SSR + Router')
          ),
          Navigation({ currentPath: currentPath() })
        ),
        el('main', { className: 'main-content' })(...(children || []))
      );
    }
);
