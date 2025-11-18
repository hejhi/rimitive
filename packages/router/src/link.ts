/**
 * Link component for declarative navigation
 */

import { create } from '@lattice/lattice';
import type { RendererConfig, RefSpec } from '@lattice/view/types';
import type { LinkOpts, LinkFactory } from './types';

/**
 * Create Link factory that renders anchor elements with SPA navigation
 */
export const createLinkFactory = create(
  <TConfig extends RendererConfig>({
    el,
    navigate,
  }: LinkOpts<TConfig>) =>
    () => {
      function Link<Tag extends string & keyof TConfig['elements']>(
        props: Record<string, unknown> & { href: string }
      ): (...children: unknown[]) => RefSpec<TConfig['elements'][Tag]> {
        return (...children: unknown[]) => {
          const { href, onClick: userOnClick, ...restProps } = props;

          // Helper to check if link is external
          const isExternal = (url: string): boolean => {
            return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
          };

          // Navigation click handler
          const handleClick = (event: MouseEvent): void => {
            // Call user's onClick if provided
            if (userOnClick && typeof userOnClick === 'function') userOnClick(event);

            // Don't intercept if:
            // - Modifier keys are pressed (allow opening in new tab)
            // - Not a left-click (button !== 0)
            // - Link is external
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.button !== 0 ||
              isExternal(href)
            ) {
              return;
            }

            // Intercept and navigate
            event.preventDefault();
            event.stopPropagation();
            navigate(href);
          };

          // Create anchor element with onClick handler merged with user's onClick
          return el('a' as never, {
            ...restProps,
            href,
            onClick: handleClick,
          })(...children);
        };
      }

      const extension: LinkFactory<TConfig> = {
        name: 'Link' as const,
        method: Link,
      };

      return extension;
    }
);
