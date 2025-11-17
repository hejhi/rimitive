import { api } from '../api';
import type { RouteComponent } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';

export const AppLayout: RouteComponent<DOMRendererConfig> = ({ el, outlet }) => {
  const isActive = (path: string) => {
    return api.currentPath() === path;
  };

  return el('div', { className: 'app-layout' })(
    el('nav', { className: 'navbar' })(
      el('div', { className: 'nav-brand' })(
        el('h1')('🧩 Lattice Router')
      ),
      el('div', { className: 'nav-links' })(
        api.Link({
          href: '/',
          className: () => isActive('/') ? 'nav-link active' : 'nav-link'
        })('Home'),
        api.Link({
          href: '/about',
          className: () => isActive('/about') ? 'nav-link active' : 'nav-link'
        })('About'),
        api.Link({
          href: '/products',
          className: () => api.currentPath().startsWith('/products') ? 'nav-link active' : 'nav-link'
        })('Products')
      )
    ),
    el('main', { className: 'main-content' })(
      outlet()
    )
  )();
};
