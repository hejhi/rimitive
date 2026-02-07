/**
 * App Layout
 *
 * Main app shell with navigation and router-based page switching.
 * StreamingPage is lazy-loaded — on the server the bundler resolves
 * it synchronously (fast path), on the client it creates an async
 * boundary until the chunk arrives.
 */
import type { RefSpec } from '@rimitive/view/types';
import type { Service } from './service.js';
import { HomePage } from './pages/index.js';

const Nav = (svc: Service) => () => {
  const { el, router } = svc;

  // Use router.navigate for SPA navigation
  const navigate = (e: Event, path: string) => {
    e.preventDefault();
    router.navigate(path);
  };

  return el('nav').props({ class: 'nav' })(
    el('a').props({
      href: '/',
      onclick: (e: Event) => navigate(e, '/'),
    })('Home'),
    el('a').props({
      href: '/streaming',
      onclick: (e: Event) => navigate(e, '/streaming'),
    })('Streaming Demo')
  );
};

const NotFound = (svc: Service) => () =>
  svc.el('div').props({ class: 'page not-found' })(
    svc.el('h1')('404 - Not Found'),
    svc.el('p')('The page you requested does not exist.'),
    svc.el('a').props({ href: '/' })('← Back to home')
  );

/**
 * Main App component with routing
 */
export const App = (svc: Service) => (): RefSpec<HTMLDivElement> => {
  const { el, router, match, lazy } = svc;

  const HomePageView = svc(HomePage);
  const NotFoundView = svc(NotFound);
  const NavView = svc(Nav);

  // Eager: start the chunk import now, register with lazy registry.
  // When the import resolves, the outer closure fires load() calls immediately.
  // This will _also_ resolve all of StreamingPage's lazy loaded service-level deps.
  const StreamingPage = lazy(() =>
    import('./pages/StreamingPage.js').then((m) => svc(m.StreamingPage))
  );

  // Route-based page rendering
  const page = match(
    () => router.matches()[0]?.id,
    (routeId: string | undefined) => {
      switch (routeId) {
        case 'home':
          return HomePageView();
        case 'streaming':
          return StreamingPage();
        default:
          return NotFoundView();
      }
    }
  );

  return el('div').props({ class: 'container' })(NavView(), page);
};
