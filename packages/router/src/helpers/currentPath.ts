import { getActiveRouterContext } from '../ssr-context';

/**
 * Creates an environment-aware currentPath signal that initializes from the correct source
 * based on whether code is running on server or client.
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
      window.location.pathname + window.location.search + window.location.hash;
    return signalFactory(fullPath);
  }
}
