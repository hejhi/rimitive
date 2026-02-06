import type { Service } from '../service.js';

export const NotFound = (svc: Service) => () =>
  svc.el('div').props({ className: 'page not-found-page' })(
    svc.el('h2')('404 — Page Not Found'),
    svc.el('p')('The page you are looking for does not exist.')
  );
