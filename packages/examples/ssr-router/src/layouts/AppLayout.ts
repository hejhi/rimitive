import { router, useSvc } from '../service.js';
import { Navigation } from '../islands/Navigation.js';

export const AppLayout = router.connect(({ currentPath }, { children }) =>
  useSvc(({ el }) => () => {
    return el('div', { className: 'app' })(
      el('nav', { className: 'navbar' })(
        el('div', { className: 'nav-brand' })(
          el('h1')('🧩 Lattice SSR + Router')
        ),
        Navigation({ currentPath: currentPath() })
      ),
      el('main', { className: 'main-content' })(...(children || []))
    );
  })
);
