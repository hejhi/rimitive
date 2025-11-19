import { router, create } from '../api';
import { Link } from '@lattice/router';

export const AppLayout = router.connect(({ currentPath }, { children }) =>
  create(({ el, computed }) => () => {
    return el('div', { className: 'app-layout' })(
      el('nav', { className: 'navbar' })(
        el('div', { className: 'nav-brand' })(el('h1')('🧩 Lattice Router')),
        el('div', { className: 'nav-links' })(
          Link({
            href: '/',
            className: computed(() =>
              currentPath() === '/' ? 'nav-link active' : 'nav-link'
            ),
          })('Home'),
          Link({
            href: '/about',
            className: computed(() =>
              currentPath() === '/about' ? 'nav-link active' : 'nav-link'
            ),
          })('About'),
          Link({
            href: '/products',
            className: computed(() =>
              currentPath().startsWith('/products')
                ? 'nav-link active'
                : 'nav-link'
            ),
          })('Products')
        )
      ),
      el('main', { className: 'main-content' })(...(children || []))
    );
  })
);
