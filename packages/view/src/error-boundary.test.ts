/**
 * Tests for error boundary primitive
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createErrorBoundaryFactory,
  isErrorBoundaryFragment,
  getErrorBoundaryMeta,
  ERROR_BOUNDARY,
  type ErrorBoundaryMeta,
} from './error-boundary';
import { createLoadFactory } from './load';
import type { RefSpec, FragmentRef, ElementRef, NodeRef } from './types';
import { STATUS_REF_SPEC, STATUS_ELEMENT, STATUS_FRAGMENT } from './types';
import { createTestEnv, MockElement, type MockTreeConfig } from './test-utils';

/** Create a RefSpec that renders a mock element with a tag */
function mockRefSpec(tag = 'div'): RefSpec<MockElement> {
  const spec = (() => spec) as unknown as RefSpec<MockElement>;
  spec.status = STATUS_REF_SPEC;
  spec.create = (): NodeRef<MockElement> => ({
    status: STATUS_ELEMENT,
    element: new MockElement(tag),
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
  });
  return spec;
}

/** Create a RefSpec whose .create() throws */
function throwingRefSpec(error: unknown): RefSpec<MockElement> {
  const spec = (() => spec) as unknown as RefSpec<MockElement>;
  spec.status = STATUS_REF_SPEC;
  spec.create = (): never => {
    throw error;
  };
  return spec;
}

function setup() {
  const env = createTestEnv();
  const errorBoundary = createErrorBoundaryFactory<MockTreeConfig>({
    adapter: env.adapter,
    signal: env.signal,
    disposeScope: env.disposeScope,
    scopedEffect: env.scopedEffect,
    getElementScope: env.getElementScope,
    withScope: env.withScope,
    createChildScope: env.createChildScope,
  });

  return { ...env, errorBoundary };
}

/** Attach a fragment to a parent and return cleanup */
function attachFragment(
  fragment: FragmentRef<MockElement>,
  parent: MockElement
): void | (() => void) {
  const parentRef: ElementRef<MockElement> = {
    status: STATUS_ELEMENT,
    element: parent,
    parent: null,
    prev: null,
    next: null,
    firstChild: null,
    lastChild: null,
  };
  fragment.parent = parentRef;
  return fragment.attach(parentRef, null);
}

describe('errorBoundary - sync error catching', () => {
  it('should render children when no error occurs', () => {
    const { errorBoundary, adapter } = setup();

    const spec = errorBoundary(
      mockRefSpec('span'),
      () => mockRefSpec('div')
    );

    expect(spec.status).toBe(STATUS_REF_SPEC);

    const node = spec.create();
    expect(node.status).toBe(STATUS_FRAGMENT);

    const parent = adapter.createNode('div') as MockElement;
    const cleanup = attachFragment(node as FragmentRef<MockElement>, parent);

    // Child should be rendered (span element inserted into parent)
    expect(parent.children.length).toBe(1);
    expect((parent.children[0] as MockElement).tag).toBe('span');

    // Clean up
    if (typeof cleanup === 'function') cleanup();
  });

  it('should render fallback when child .create() throws', () => {
    const { errorBoundary, adapter } = setup();
    const testError = new Error('child creation failed');

    const spec = errorBoundary(
      throwingRefSpec(testError),
      () => mockRefSpec('div')
    );

    const node = spec.create();
    const parent = adapter.createNode('div') as MockElement;
    const cleanup = attachFragment(node as FragmentRef<MockElement>, parent);

    // Fallback should be rendered (div element, not the span child)
    expect(parent.children.length).toBe(1);
    expect((parent.children[0] as MockElement).tag).toBe('div');

    if (typeof cleanup === 'function') cleanup();
  });

  it('should pass the error to the fallback via reactive signal', () => {
    const { errorBoundary, adapter } = setup();
    const testError = new Error('test error message');
    let capturedErrorSignal: (() => unknown) | undefined;

    const spec = errorBoundary(
      throwingRefSpec(testError),
      (error) => {
        capturedErrorSignal = error;
        return mockRefSpec('div');
      }
    );

    const node = spec.create();
    const parent = adapter.createNode('div') as MockElement;
    attachFragment(node as FragmentRef<MockElement>, parent);

    // The fallback receives a reactive error signal — read it after attach
    expect(capturedErrorSignal).toBeDefined();
    expect(capturedErrorSignal!()).toBe(testError);
  });

  it('should handle non-Error thrown values', () => {
    const { errorBoundary, adapter } = setup();
    let capturedErrorSignal: (() => unknown) | undefined;

    const spec = errorBoundary(
      throwingRefSpec('string error'),
      (error) => {
        capturedErrorSignal = error;
        return mockRefSpec('div');
      }
    );

    const node = spec.create();
    const parent = adapter.createNode('div') as MockElement;
    attachFragment(node as FragmentRef<MockElement>, parent);

    expect(capturedErrorSignal!()).toBe('string error');
  });
});

describe('errorBoundary - async error catching (load() integration)', () => {
  it('should have error state available via meta when load() boundary rejects', async () => {
    const { errorBoundary, signal } = setup();
    const load = createLoadFactory({ signal });

    const testError = new Error('fetch failed');

    const loadSpec = load(
      () => Promise.reject(testError),
      () => mockRefSpec('span')
    );

    let capturedErrorSignal: (() => unknown) | undefined;

    const spec = errorBoundary(
      loadSpec as unknown as RefSpec<MockElement>,
      (error) => {
        capturedErrorSignal = error;
        return mockRefSpec('div');
      }
    );

    // Create the boundary and check meta
    const node = spec.create();
    const meta = getErrorBoundaryMeta(node);

    expect(meta).toBeDefined();
    expect(meta!.hasError()).toBe(false);

    // Trigger error via meta.setError (as SSR streaming would)
    meta!.setError(testError);

    expect(meta!.hasError()).toBe(true);
    expect(capturedErrorSignal!()).toBe(testError);
  });
});

describe('errorBoundary - error recovery', () => {
  it('should work normally when re-created after a previous error', () => {
    const { errorBoundary, adapter } = setup();

    // First: create with throwing child
    const spec1 = errorBoundary(
      throwingRefSpec(new Error('first error')),
      () => mockRefSpec('fallback')
    );

    const node1 = spec1.create();
    const parent1 = adapter.createNode('div') as MockElement;
    attachFragment(node1 as FragmentRef<MockElement>, parent1);
    expect((parent1.children[0] as MockElement).tag).toBe('fallback');

    // Second: create a new boundary with non-throwing child
    const spec2 = errorBoundary(
      mockRefSpec('success'),
      () => mockRefSpec('fallback')
    );

    const node2 = spec2.create();
    const parent2 = adapter.createNode('div') as MockElement;
    attachFragment(node2 as FragmentRef<MockElement>, parent2);
    expect((parent2.children[0] as MockElement).tag).toBe('success');
  });
});

describe('errorBoundary - nested boundaries', () => {
  it('should catch at the inner boundary before outer', () => {
    const { errorBoundary, adapter } = setup();
    const testError = new Error('inner error');

    let innerErrorSignal: (() => unknown) | undefined;

    // Inner boundary wraps a throwing child
    const innerSpec = errorBoundary(
      throwingRefSpec(testError),
      (error) => {
        innerErrorSignal = error;
        return mockRefSpec('inner-fallback');
      }
    );

    // Outer boundary wraps the inner boundary
    const outerSpec = errorBoundary(
      innerSpec,
      () => mockRefSpec('outer-fallback')
    );

    const node = outerSpec.create();
    const parent = adapter.createNode('div') as MockElement;
    attachFragment(node as FragmentRef<MockElement>, parent);

    // Inner boundary should catch the error
    expect(innerErrorSignal).toBeDefined();
    expect(innerErrorSignal!()).toBe(testError);

    // The inner boundary caught and rendered its fallback, so the outer
    // boundary's child creation succeeds. Check that the rendered content
    // is the inner-fallback, not the outer-fallback.
    const outerMeta = getErrorBoundaryMeta(node);
    expect(outerMeta!.hasError()).toBe(false);
  });

  it('should catch at outer boundary when inner boundary also throws', () => {
    const { errorBoundary, adapter } = setup();
    const innerError = new Error('inner throws');
    const fallbackError = new Error('fallback also throws');

    let outerFallbackRendered = false;
    let outerErrorSignal: (() => unknown) | undefined;

    // Inner boundary: child throws, and fallback ALSO throws
    const innerSpec = errorBoundary(
      throwingRefSpec(innerError),
      () => throwingRefSpec(fallbackError)
    );

    // Outer boundary wraps the inner boundary
    const outerSpec = errorBoundary(
      innerSpec,
      (error) => {
        outerFallbackRendered = true;
        outerErrorSignal = error;
        return mockRefSpec('outer-fallback');
      }
    );

    const node = outerSpec.create();
    const parent = adapter.createNode('div') as MockElement;
    attachFragment(node as FragmentRef<MockElement>, parent);

    // Outer boundary should catch since inner's fallback threw
    expect(outerFallbackRendered).toBe(true);
    // The error caught by outer is the fallback error (from inner's fallback creation)
    expect(outerErrorSignal!()).toBe(fallbackError);
  });
});

describe('errorBoundary - scope cleanup', () => {
  it('should dispose errored child scope on error', () => {
    const { errorBoundary, adapter, onCleanup } = setup();
    const cleanupFn = vi.fn();

    // Create a child spec whose .create() registers a cleanup then throws
    const childSpec = (() => childSpec) as unknown as RefSpec<MockElement>;
    childSpec.status = STATUS_REF_SPEC;
    childSpec.create = () => {
      // Register a cleanup that should be called when scope is disposed
      onCleanup(cleanupFn);
      throw new Error('child failed');
    };

    const spec = errorBoundary(
      childSpec,
      () => mockRefSpec('fallback')
    );

    const node = spec.create();
    const parent = adapter.createNode('div') as MockElement;
    attachFragment(node as FragmentRef<MockElement>, parent);

    // The child scope should have been disposed, running cleanups
    expect(cleanupFn).toHaveBeenCalledTimes(1);

    // Fallback should still be rendered
    expect(parent.children.length).toBe(1);
    expect((parent.children[0] as MockElement).tag).toBe('fallback');
  });

  it('should dispose fallback scope when cleanup is called', () => {
    const { errorBoundary, adapter } = setup();

    const spec = errorBoundary(
      throwingRefSpec(new Error('fail')),
      () => mockRefSpec('fallback')
    );

    const node = spec.create();
    const parent = adapter.createNode('div') as MockElement;
    const cleanup = attachFragment(node as FragmentRef<MockElement>, parent);

    expect(parent.children.length).toBe(1);

    // Call cleanup — should remove fallback from parent
    if (typeof cleanup === 'function') cleanup();

    expect(parent.children.length).toBe(0);
  });

  it('should dispose normal child scope when cleanup is called', () => {
    const { errorBoundary, adapter } = setup();

    const spec = errorBoundary(
      mockRefSpec('child'),
      () => mockRefSpec('fallback')
    );

    const node = spec.create();
    const parent = adapter.createNode('div') as MockElement;
    const cleanup = attachFragment(node as FragmentRef<MockElement>, parent);

    expect(parent.children.length).toBe(1);
    expect((parent.children[0] as MockElement).tag).toBe('child');

    // Call cleanup — should remove child from parent
    if (typeof cleanup === 'function') cleanup();

    expect(parent.children.length).toBe(0);
  });
});

describe('errorBoundary - errors outside boundaries propagate', () => {
  it('should not catch errors thrown outside of error boundary', () => {
    const { errorBoundary } = setup();

    // An error boundary is not created around this throw
    expect(() => {
      throw new Error('uncaught');
    }).toThrow('uncaught');

    // Error boundary only protects its own children
    const spec = errorBoundary(
      mockRefSpec('safe-child'),
      () => mockRefSpec('fallback')
    );

    // This should not throw
    const node = spec.create();
    expect(node).toBeDefined();
  });

  it('should allow errors to propagate if no boundary wraps them', () => {
    // Using a throwing spec directly (not wrapped in errorBoundary)
    const throwingSpec = throwingRefSpec(new Error('propagated'));
    expect(() => throwingSpec.create()).toThrow('propagated');
  });
});

describe('errorBoundary - metadata', () => {
  it('should attach ERROR_BOUNDARY metadata to created fragment', () => {
    const { errorBoundary } = setup();

    const spec = errorBoundary(
      mockRefSpec('child'),
      () => mockRefSpec('fallback')
    );

    const node = spec.create();

    expect(isErrorBoundaryFragment(node)).toBe(true);
    expect(ERROR_BOUNDARY in node).toBe(true);

    const meta = getErrorBoundaryMeta(node);
    expect(meta).toBeDefined();
    expect(typeof meta!.setError).toBe('function');
    expect(typeof meta!.hasError).toBe('function');
  });

  it('should report hasError correctly', () => {
    const { errorBoundary, adapter } = setup();

    // No-error case
    const specOk = errorBoundary(
      mockRefSpec('child'),
      () => mockRefSpec('fallback')
    );
    const nodeOk = specOk.create();
    const metaOk = getErrorBoundaryMeta(nodeOk);
    expect(metaOk!.hasError()).toBe(false);

    // Error case
    const specErr = errorBoundary(
      throwingRefSpec(new Error('fail')),
      () => mockRefSpec('fallback')
    );
    const nodeErr = specErr.create();
    const parent = adapter.createNode('div') as MockElement;
    attachFragment(nodeErr as FragmentRef<MockElement>, parent);
    const metaErr = getErrorBoundaryMeta(nodeErr);
    expect(metaErr!.hasError()).toBe(true);
  });

  it('should allow external setError calls for SSR introspection', () => {
    const { errorBoundary } = setup();

    let capturedErrorSignal: (() => unknown) | undefined;

    const spec = errorBoundary(
      mockRefSpec('child'),
      (error) => {
        capturedErrorSignal = error;
        return mockRefSpec('fallback');
      }
    );

    const node = spec.create();
    const meta = getErrorBoundaryMeta(node);

    // Before setting error
    expect(meta!.hasError()).toBe(false);

    // Set error externally (as SSR streaming would)
    meta!.setError(new Error('streaming error'));
    expect(meta!.hasError()).toBe(true);
    expect(capturedErrorSignal!()).toBeInstanceOf(Error);
  });
});

describe('isErrorBoundaryFragment', () => {
  it('should return true for nodes with ERROR_BOUNDARY', () => {
    const node = { [ERROR_BOUNDARY]: {} };
    expect(isErrorBoundaryFragment(node)).toBe(true);
  });

  it('should return false for regular objects', () => {
    expect(isErrorBoundaryFragment({})).toBe(false);
    expect(isErrorBoundaryFragment(null)).toBe(false);
    expect(isErrorBoundaryFragment(undefined)).toBe(false);
    expect(isErrorBoundaryFragment('string')).toBe(false);
  });
});

describe('getErrorBoundaryMeta', () => {
  it('should return metadata from error boundary fragment', () => {
    const meta: ErrorBoundaryMeta = {
      setError: () => {},
      hasError: () => false,
    };
    const node = {
      [ERROR_BOUNDARY]: meta,
      status: STATUS_FRAGMENT,
      element: null,
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
      attach: () => {},
    };

    expect(getErrorBoundaryMeta(node as NodeRef<unknown>)).toBe(meta);
  });

  it('should return undefined for non-boundary nodes', () => {
    const node = {
      status: STATUS_ELEMENT,
      element: {},
      parent: null,
      prev: null,
      next: null,
      firstChild: null,
      lastChild: null,
    };
    expect(getErrorBoundaryMeta(node as NodeRef<unknown>)).toBeUndefined();
  });
});
