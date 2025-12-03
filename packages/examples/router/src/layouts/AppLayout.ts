import { el, computed, currentPath } from '../service';
import { router } from '../service';
import { Link } from '@lattice/router';

export const AppLayout = router.connect(
  ({ children }) => () =>
    el('div').props({ className: 'app-layout' })(
      el('nav').props({ className: 'navbar' })(
        el('div').props({ className: 'nav-brand' })(el('h1')('🧩 Lattice Router')),
        el('div').props({ className: 'nav-links' })(
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
      el('main').props({ className: 'main-content' })(...(children || []))
    )
);
