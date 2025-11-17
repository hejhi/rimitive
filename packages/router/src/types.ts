/**
 * Route parameter map extracted from path patterns
 * e.g., '/products/:id' -> { id: string }
 */
export type RouteParams = Record<string, string>;

/**
 * Matched route information
 */
export interface RouteMatch {
  path: string;
  params: RouteParams;
}

// RouteConfig removed - was unused placeholder
