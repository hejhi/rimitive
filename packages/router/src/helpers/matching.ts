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
 * @param pattern - Route pattern (e.g., '/', '/about', '/products/:id', '*')
 * @param path - URL path to match against
 * @returns RouteMatch if matched, null otherwise
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
 * @param pattern - Route pattern (e.g., '/', '/products', '/users/:id', '*')
 * @param path - URL path to match against
 * @returns RouteMatch if matched, null otherwise
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
