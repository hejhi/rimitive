import { getActiveRouterContext } from '../ssr-context';

/**
 * Creates an environment-aware currentPath signal that initializes from the correct source
 * based on whether code is running on server or client.
 *
 * The signal contains the full URL path including pathname, search params, and hash fragment.
 *
 * **Environment Detection:**
 * - **Server (SSR):** Initializes from `ssrContext.initialPath` which contains the incoming request path
 * - **Client:** Initializes from `window.location` (pathname + search + hash)
 *
 * This helper ensures the router starts with the correct path in both environments:
 * - During SSR, the server needs to render the route matching the incoming request
 * - During hydration, the client needs to match what was rendered on the server
 * - During client-side navigation, the signal tracks the current browser location
 *
 * @example Server-side usage (SSR)
 * ```ts
 * import { signal } from '@lattice/signals';
 * import { createCurrentPathSignal } from './helpers/currentPath';
 *
 * // Inside a router that runs during SSR
 * const currentPath = createCurrentPathSignal(signal);
 * // currentPath() === '/products/123?view=details' (from SSR context)
 * ```
 *
 * @example Client-side usage
 * ```ts
 * import { signal } from '@lattice/signals';
 * import { createCurrentPathSignal } from './helpers/currentPath';
 *
 * // Inside a router that runs in the browser
 * const currentPath = createCurrentPathSignal(signal);
 * // currentPath() === window.location.pathname + window.location.search + window.location.hash
 * ```
 *
 * @param signalFactory - A signal factory function that creates reactive signals
 * @returns A signal initialized with the current path from the appropriate source
 */
export function createCurrentPathSignal(
  signalFactory: <T>(value: T) => { (): T; (value: T): void; peek(): T }
): { (): string; (value: string): void; peek(): string } {
  const ssrContext = getActiveRouterContext();

  if (ssrContext) {
    // SERVER: Use initial path from SSR context
    // During SSR, we need to render the route matching the incoming request
    return signalFactory(ssrContext.initialPath);
  } else {
    // CLIENT: Read from window.location
    // In the browser, get the full current URL path including search and hash
    const fullPath =
      window.location.pathname +
      window.location.search +
      window.location.hash;
    return signalFactory(fullPath);
  }
}
