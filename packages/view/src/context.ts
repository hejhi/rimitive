/**
 * View context for concurrency-safe scope tracking
 */

import type { Scope } from './helpers/scope';

export interface ViewContext {
  currentScope: Scope | null;
}

export function createViewContext(): ViewContext {
  return {
    currentScope: null,
  };
}
