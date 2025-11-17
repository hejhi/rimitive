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

          // Type guard for onClick function
          type ClickHandler = (event: MouseEvent) => void | boolean;

          // Navigation click handler
          const handleClick = (event: MouseEvent): void => {
            // Call user's onClick if provided
            if (userOnClick && typeof userOnClick === 'function') {
              (userOnClick as ClickHandler)(event);
            }

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

          // Create anchor element with merged props
          // Use a lifecycle callback to add the event listener properly
          return el('a' as never, {
            ...restProps,
            href,
          })(...children)((element) => {
            // Add event listener to ensure it runs before default action
            const anchorElement = element as unknown as HTMLAnchorElement;
            anchorElement.addEventListener('click', handleClick as EventListener, false);

            // Return cleanup function
            return () => {
              anchorElement.removeEventListener('click', handleClick as EventListener, false);
            };
          }) as RefSpec<TConfig['elements'][Tag]>;
        };
      }

      const extension: LinkFactory<TConfig> = {
        name: 'Link' as const,
        method: Link,
      };

      return extension;
    }
);
