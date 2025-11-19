import { api } from '../api';
import { Link, type RouteComponent } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';

export const AppLayout: RouteComponent<DOMRendererConfig> = ({ el, outlet }) => {
  return el('div', { className: 'app-layout' })(
    el('nav', { className: 'navbar' })(
      el('div', { className: 'nav-brand' })(
        el('h1')('🧩 Lattice Router')
      ),
      el('div', { className: 'nav-links' })(
        Link({
          href: '/',
          className: api.computed(() => api.currentPath() === '/' ? 'nav-link active' : 'nav-link')
        })('Home'),
        Link({
          href: '/about',
          className: api.computed(() => api.currentPath() === '/about' ? 'nav-link active' : 'nav-link')
        })('About'),
        Link({
          href: '/products',
          className: api.computed(() => api.currentPath().startsWith('/products') ? 'nav-link active' : 'nav-link')
        })('Products')
      )
    ),
    el('main', { className: 'main-content' })(
      outlet()
    )
  )();
};
