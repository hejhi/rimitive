/**
 * Location primitive for reactive URL state access
 */

import { create } from '@lattice/lattice';
import type { LocationOpts, LocationFactory, LocationAPI } from './types';

/**
 * Parse query string into object
 * e.g., "?sort=price&filter=new" -> { sort: "price", filter: "new" }
 */
function parseQueryString(search: string): Record<string, string> {
  if (!search || search === '?') {
    return {};
  }

  // Remove leading '?' if present
  const queryString = search.startsWith('?') ? search.slice(1) : search;

  const params: Record<string, string> = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    if (!pair) continue;

    const equalsIndex = pair.indexOf('=');
    if (equalsIndex === -1) {
      // No '=' means param without value
      params[pair] = '';
    } else {
      const key = pair.slice(0, equalsIndex);
      const value = pair.slice(equalsIndex + 1);
      params[key] = value;
    }
  }

  return params;
}

/**
 * Parse URL into components
 */
function parseURL(url: string): {
  pathname: string;
  search: string;
  hash: string;
} {
  // Find hash first (everything after #)
  const hashIndex = url.indexOf('#');
  const hash = hashIndex !== -1 ? url.slice(hashIndex) : '';
  const urlWithoutHash = hashIndex !== -1 ? url.slice(0, hashIndex) : url;

  // Find query string (everything after ?)
  const searchIndex = urlWithoutHash.indexOf('?');
  const search = searchIndex !== -1 ? urlWithoutHash.slice(searchIndex) : '';
  const pathname =
    searchIndex !== -1 ? urlWithoutHash.slice(0, searchIndex) : urlWithoutHash;

  return { pathname, search, hash };
}

/**
 * Create location factory that provides reactive access to URL state
 */
export const createLocationFactory = create(
  ({ computed, currentPath }: LocationOpts) => {
    return () => {
      function location(): LocationAPI {
        // Create computed values for each part of the URL
        const pathname = computed(() => {
          const path = currentPath();
          return parseURL(path).pathname;
        });

        const search = computed(() => {
          const path = currentPath();
          return parseURL(path).search;
        });

        const hash = computed(() => {
          const path = currentPath();
          return parseURL(path).hash;
        });

        const query = computed(() => {
          const path = currentPath();
          const { search: searchString } = parseURL(path);
          return parseQueryString(searchString);
        });

        return {
          pathname,
          search,
          hash,
          query,
        };
      }

      const extension: LocationFactory = {
        name: 'location' as const,
        method: location,
      };

      return extension;
    };
  }
);
