/**
 * Path matching utilities for route patterns
 */

import type { RouteMatch } from '../types';

/**
 * Compose a parent path with a child path
 *
 * @param parentPath - Parent route path (e.g., '/', '/products')
 * @param childPath - Child route path (e.g., 'about', ':id', '*')
 * @returns Combined path (e.g., '/about', '/products/:id', '*')
 *
 * @example
 * ```typescript
 * import { composePath } from '@lattice/router';
 *
 * composePath('/', 'about');          // '/about'
 * composePath('/products', ':id');    // '/products/:id'
 * composePath('/api', 'users');       // '/api/users'
 * composePath('/any', '*');           // '*' (wildcard stays as wildcard)
 * ```
 */
export const composePath = (parentPath: string, childPath: string): string => {
  // Wildcard stays as wildcard, regardless of parent
  if (childPath === '*') {
    return '*';
  }

  // If parent is root, just add a leading slash to child
  if (parentPath === '/') {
    return `/${childPath}`;
  }

  // Otherwise combine with a slash
  return `${parentPath}/${childPath}`;
};

/**
 * Matches a URL path against a route pattern (exact match)
 *
 * Supports exact string matching, path parameters using :paramName syntax, and wildcard '*' for catch-all
 *
 * @example
 * ```typescript
 * import { matchPath } from '@lattice/router';
 *
 * // Exact match
 * matchPath('/about', '/about');
 * // { path: '/about', params: {} }
 *
 * // Path parameters
 * matchPath('/products/:id', '/products/123');
 * // { path: '/products/123', params: { id: '123' } }
 *
 * // Multiple parameters
 * matchPath('/blog/:year/:slug', '/blog/2024/hello-world');
 * // { path: '/blog/2024/hello-world', params: { year: '2024', slug: 'hello-world' } }
 *
 * // Wildcard
 * matchPath('*', '/any/path');
 * // { path: '/any/path', params: {} }
 *
 * // No match
 * matchPath('/about', '/contact');
 * // null
 * ```
 */
export const matchPath = (pattern: string, path: string): RouteMatch | null => {
  // Wildcard matches any path
  if (pattern === '*') {
    return {
      path,
      params: {},
    };
  }

  // Exact match (no parameters)
  if (pattern === path) {
    return {
      path,
      params: {},
    };
  }

  // Split into segments
  const patternSegments = pattern.split('/');
  const pathSegments = path.split('/');

  // Must have same number of segments
  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  // Match each segment
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];

    if (patternSegment === undefined || pathSegment === undefined) {
      return null;
    }

    // Parameter segment (starts with :)
    if (patternSegment.startsWith(':')) {
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      // Static segment must match exactly
      return null;
    }
  }

  return {
    path,
    params,
  };
};

/**
 * Matches a URL path against a route pattern (prefix match for parent routes)
 *
 * Used for routes with children - matches if the path starts with the pattern
 *
 * @example
 * ```typescript
 * import { matchPathPrefix } from '@lattice/router';
 *
 * // Prefix match for parent routes
 * matchPathPrefix('/products', '/products/123');
 * // { path: '/products/123', params: {} }
 *
 * // With parameters
 * matchPathPrefix('/blog/:year', '/blog/2024/hello-world');
 * // { path: '/blog/2024/hello-world', params: { year: '2024' } }
 *
 * // Root matches everything
 * matchPathPrefix('/', '/any/path');
 * // { path: '/any/path', params: {} }
 *
 * // Exact match still works
 * matchPathPrefix('/about', '/about');
 * // { path: '/about', params: {} }
 *
 * // No match when path is shorter
 * matchPathPrefix('/products/category', '/products');
 * // null
 * ```
 */
export const matchPathPrefix = (
  pattern: string,
  path: string
): RouteMatch | null => {
  // Wildcard matches any path
  if (pattern === '*') {
    return {
      path,
      params: {},
    };
  }

  // Exact match
  if (pattern === path) {
    return {
      path,
      params: {},
    };
  }

  // For root pattern, it matches any path
  if (pattern === '/') {
    return {
      path,
      params: {},
    };
  }

  // Split into segments for comparison
  const patternSegments = pattern.split('/');
  const pathSegments = path.split('/');

  // Path must have at least as many segments as pattern (prefix match)
  if (pathSegments.length < patternSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  // Match each segment of the pattern against the path
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    const pathSegment = pathSegments[i];

    if (patternSegment === undefined || pathSegment === undefined) {
      return null;
    }

    if (patternSegment.startsWith(':')) {
      // Parameter segment - extract the value
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      // Static segment must match exactly
      return null;
    }
  }

  // All pattern segments matched
  return {
    path,
    params,
  };
};
