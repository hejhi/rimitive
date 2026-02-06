/**
 * SideNav Component
 *
 * Sidebar navigation with router integration.
 * Shows Overview, Feed links and a sites section listing mock sites.
 */
import { SITES } from '../data/sites.js';
import type { Service } from '../service.js';

export const SideNav =
  ({ el, computed, router }: Service) =>
  () => {
    const a = el('a');
    const div = el('div');
    const span = el('span');
    const nav = el('nav');
    const h3 = el('h3');

    const navLink = (href: string, label: string) =>
      a.props({
        href,
        className: computed(() =>
          router.currentPath() === href ? 'nav-link active' : 'nav-link'
        ),
        onclick: (e: MouseEvent) => {
          e.preventDefault();
          router.navigate(href, 'forward');
        },
      })(label);

    const siteLink = (site: (typeof SITES)[number]) =>
      a.props({
        href: `/sites/${site.id}`,
        className: computed(() =>
          router.currentPath() === `/sites/${site.id}`
            ? 'nav-link active'
            : 'nav-link'
        ),
        onclick: (e: MouseEvent) => {
          e.preventDefault();
          router.navigate(`/sites/${site.id}`, 'forward');
        },
      })(
        span.props({
          className: 'site-dot',
          style: `background-color: ${site.color}`,
        })(),
        site.name
      );

    return nav.props({ className: 'side-nav' })(
      div.props({ className: 'nav-section' })(
        h3.props({})(
          'Dashboard'
        ),
        navLink('/', 'Overview'),
        navLink('/feed', 'Feed')
      ),
      div.props({ className: 'nav-section' })(
        h3.props({})(
          'Sites'
        ),
        ...SITES.map(siteLink)
      )
    );
  };
