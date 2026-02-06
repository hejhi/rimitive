/**
 * Shared test fixtures for SSR server render tests.
 */

import { STATUS_REF_SPEC } from '@rimitive/view/types';
import type { RefSpec, NodeRef } from '@rimitive/view/types';
import { createSignalFactory, SignalFactory } from '@rimitive/signals/signal';
import { createGraphEdges } from '@rimitive/signals/deps/graph-edges';
import { createScheduler } from '@rimitive/signals/deps/scheduler';
import { createGraphTraversal } from '@rimitive/signals/deps/graph-traversal';
import type { Serialize } from './parse5-adapter';

export const serialize: Serialize = (el: unknown) =>
  (el as { outerHTML: string }).outerHTML;

export function createMockRefSpec(html: string): RefSpec<unknown> {
  return {
    status: STATUS_REF_SPEC,
    create: () => ({
      status: 1 as const,
      element: { outerHTML: html },
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    }),
  };
}

export function createServerTestEnv(): {
  signal: SignalFactory;
} {
  const graphEdges = createGraphEdges();
  const { withVisitor } = createGraphTraversal();
  const scheduler = createScheduler({
    detachAll: graphEdges.detachAll,
    withVisitor,
  });

  const signal = createSignalFactory({
    graphEdges,
    propagate: scheduler.propagate,
  });

  return { signal };
}

export function mockMount(spec: RefSpec<unknown>): NodeRef<unknown> {
  return spec.create();
}

export function mockInsertFragmentMarkers(): void {
  // Mock implementation - does nothing for these tests
}
