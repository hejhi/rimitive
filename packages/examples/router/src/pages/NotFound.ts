import type { RouteComponent } from '@lattice/router';
import type { DOMRendererConfig } from '@lattice/view/renderers/dom';

export const NotFound: RouteComponent<DOMRendererConfig> = ({ el, navigate }) => {
  return el('div', { className: 'page not-found' })(
    el('div', { className: 'not-found-content' })(
      el('h1', { className: 'not-found-title' })('404'),
      el('h2')('Page Not Found'),
      el('p')('The page you are looking for does not exist.'),
      el('button', {
        className: 'primary-btn',
        onclick: () => navigate('/')
      })('← Go Home')
    )
  )();
};
