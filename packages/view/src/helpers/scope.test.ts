import { describe, it, expect, vi } from 'vitest';
import { createMockElement, MockTestElement } from '../test-helpers';
import { createScopes } from './scope';
import type { RenderScope } from '../types';

// Status constants for RenderScope disposal tracking (matches scope.ts)
const DISPOSED = 1 << 2;  // Bit 2: disposed state

/**
 * Best-in-class TDD tests for scope management
 *
 * These tests verify behavior through the public API only:
 * - createElementScope: Create scopes for elements
 * - onCleanup: Register cleanup functions
 * - scopedEffect: Create effects within a scope
 * - disposeScope: Dispose scopes and verify cascading cleanup
 *
 * Tests verify OBSERVABLE BEHAVIOR, not implementation details.
 */

describe('Scope Management', () => {
  const createTestEnv = () => {
    const baseEffect = vi.fn((fn: () => void | (() => void)) => {
      const cleanup = fn();
      return cleanup || (() => {});
    });

    const scopes = createScopes({ baseEffect });

    return { ...scopes, baseEffect };
  };

  describe('cleanup registration', () => {
    it('runs cleanup functions when scope is disposed', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();
      const element = createMockElement();
      const cleanup = vi.fn();

      const scope = createElementScope(element, () => {
        onCleanup(cleanup);
      });

      expect(scope).toBeTruthy();
      expect(cleanup).not.toHaveBeenCalled();

      disposeScope(scope!);
      expect(cleanup).toHaveBeenCalledOnce();
    });

    it('runs multiple cleanup functions in registration order', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();
      const element = createMockElement();
      const calls: number[] = [];

      const scope = createElementScope(element, () => {
        onCleanup(() => calls.push(1));
        onCleanup(() => calls.push(2));
        onCleanup(() => calls.push(3));
      });

      disposeScope(scope!);
      // Cleanups run in LIFO order (like a stack)
      expect(calls).toEqual([3, 2, 1]);
    });

    it('does not create scope when no cleanup is registered', () => {
      const { createElementScope } = createTestEnv();
      const element = createMockElement();

      const scope = createElementScope(element, () => {
        // No cleanup registered
      });

      expect(scope).toBeNull();
    });
  });

  describe('scope hierarchy', () => {
    it('creates parent-child hierarchy when scopes are nested', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();
      const parentElement = createMockElement();
      const childElement = createMockElement();

      const parentCleanup = vi.fn();
      const childCleanup = vi.fn();

      const parentScope = createElementScope(parentElement, () => {
        onCleanup(parentCleanup);

        // Create child within parent scope
        createElementScope(childElement, () => {
          onCleanup(childCleanup);
        });
      });

      expect(parentScope).toBeTruthy();

      // Dispose parent - should cascade to child
      disposeScope(parentScope!);

      expect(parentCleanup).toHaveBeenCalledOnce();
      expect(childCleanup).toHaveBeenCalledOnce();
    });

    it('disposes entire tree when root is disposed', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();

      const rootCleanup = vi.fn();
      const child1Cleanup = vi.fn();
      const child2Cleanup = vi.fn();
      const grandchildCleanup = vi.fn();

      const rootScope = createElementScope(createMockElement(), () => {
        onCleanup(rootCleanup);

        // Child 1 with its own grandchild
        createElementScope(createMockElement(), () => {
          onCleanup(child1Cleanup);

          createElementScope(createMockElement(), () => {
            onCleanup(grandchildCleanup);
          });
        });

        // Child 2 (sibling of child 1)
        createElementScope(createMockElement(), () => {
          onCleanup(child2Cleanup);
        });
      });

      disposeScope(rootScope!);

      // All cleanups called
      expect(rootCleanup).toHaveBeenCalledOnce();
      expect(child1Cleanup).toHaveBeenCalledOnce();
      expect(child2Cleanup).toHaveBeenCalledOnce();
      expect(grandchildCleanup).toHaveBeenCalledOnce();
    });

    it('supports multiple levels of nesting', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();

      const cleanups = Array.from({ length: 5 }, () => vi.fn());

      const rootScope = createElementScope(createMockElement(), () => {
        onCleanup(cleanups[0]!);
        createElementScope(createMockElement(), () => {
          onCleanup(cleanups[1]!);
          createElementScope(createMockElement(), () => {
            onCleanup(cleanups[2]!);
            createElementScope(createMockElement(), () => {
              onCleanup(cleanups[3]!);
              createElementScope(createMockElement(), () => {
                onCleanup(cleanups[4]!);
              });
            });
          });
        });
      });

      disposeScope(rootScope!);
      cleanups.forEach(cleanup => expect(cleanup).toHaveBeenCalledOnce());
    });
  });

  describe('scopedEffect', () => {
    it('registers effect cleanup in active scope', () => {
      const { createElementScope, scopedEffect, disposeScope } = createTestEnv();
      const element = createMockElement();
      const effectCleanup = vi.fn();

      const scope = createElementScope(element, () => {
        scopedEffect(() => {
          return effectCleanup;
        });
      });

      expect(effectCleanup).not.toHaveBeenCalled();

      disposeScope(scope!);
      expect(effectCleanup).toHaveBeenCalledOnce();
    });

    it('runs effect immediately and tracks cleanup', () => {
      const { createElementScope, scopedEffect, disposeScope, baseEffect } = createTestEnv();
      const element = createMockElement();

      const scope = createElementScope(element, () => {
        scopedEffect(() => {
          return () => {};
        });
      });

      expect(baseEffect).toHaveBeenCalledOnce();
      disposeScope(scope!);
    });

    it('combines multiple effects in same scope', () => {
      const { createElementScope, scopedEffect, disposeScope } = createTestEnv();
      const element = createMockElement();

      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      const scope = createElementScope(element, () => {
        scopedEffect(() => cleanup1);
        scopedEffect(() => cleanup2);
      });

      disposeScope(scope!);
      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).toHaveBeenCalledOnce();
    });
  });

  describe('disposal idempotency', () => {
    it('handles multiple dispose calls gracefully', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();
      const element = createMockElement();
      const cleanup = vi.fn();

      const scope = createElementScope(element, () => {
        onCleanup(cleanup);
      });

      disposeScope(scope!);
      expect(cleanup).toHaveBeenCalledOnce();

      // Second disposal should be no-op
      disposeScope(scope!);
      expect(cleanup).toHaveBeenCalledOnce(); // Still only once
    });

    it('marks scope as disposed after disposal', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();
      const element = createMockElement();

      const scope = createElementScope(element, () => {
        onCleanup(() => {});
      });

      expect(scope!.status & DISPOSED).toBe(0);

      disposeScope(scope!);

      expect(scope!.status & DISPOSED).toBe(DISPOSED);
    });
  });

  describe('element-scope mapping', () => {
    it('maps element to scope when cleanup is registered', () => {
      const { createElementScope, onCleanup, getElementScope } = createTestEnv();
      const element = createMockElement();

      const scope = createElementScope(element, () => {
        onCleanup(() => {});
      });

      expect(getElementScope(element)).toBe(scope);
    });

    it('does not map element when no cleanup is registered', () => {
      const { createElementScope, getElementScope } = createTestEnv();
      const element = createMockElement();

      createElementScope(element, () => {
        // No cleanup
      });

      expect(getElementScope(element)).toBeUndefined();
    });

    it('removes element mapping after disposal', () => {
      const { createElementScope, onCleanup, disposeScope, getElementScope } = createTestEnv();
      const element = createMockElement();

      const scope = createElementScope(element, () => {
        onCleanup(() => {});
      });

      expect(getElementScope(element)).toBeDefined();

      disposeScope(scope!);

      expect(getElementScope(element)).toBeUndefined();
    });
  });

  describe('mixed cleanup types', () => {
    it('disposes both onCleanup and scopedEffect in same scope', () => {
      const { createElementScope, onCleanup, scopedEffect, disposeScope } = createTestEnv();
      const element = createMockElement();

      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();

      const scope = createElementScope(element, () => {
        onCleanup(cleanup1);
        scopedEffect(() => cleanup2);
      });

      disposeScope(scope!);

      expect(cleanup1).toHaveBeenCalledOnce();
      expect(cleanup2).toHaveBeenCalledOnce();
    });

    it('stops at first cleanup that throws', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();
      const element = createMockElement();

      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn(() => { throw new Error('cleanup error'); });
      const cleanup3 = vi.fn();

      const scope = createElementScope(element, () => {
        onCleanup(cleanup1);
        onCleanup(cleanup2);
        onCleanup(cleanup3);
      });

      // Disposal throws if cleanup throws
      expect(() => disposeScope(scope!)).toThrow('cleanup error');

      // Cleanups run in LIFO order, so 3 and 2 run, but error stops before 1
      expect(cleanup3).toHaveBeenCalled();
      expect(cleanup2).toHaveBeenCalled();
      expect(cleanup1).not.toHaveBeenCalled();
    });
  });

  describe('performance characteristics', () => {
    it('creates deep hierarchies without stack overflow', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();

      const depth = 1000;
      let currentScope: RenderScope<MockTestElement> | null = null;

      // Build deep chain
      const buildChain = (n: number): void => {
        if (n === 0) return;

        const scope = createElementScope(createMockElement(), () => {
          onCleanup(() => {});
          buildChain(n - 1);
        });

        if (n === depth) currentScope = scope;
      };

      buildChain(depth);

      // Should dispose entire chain without stack overflow
      expect(() => disposeScope(currentScope!)).not.toThrow();
    });

    it('handles wide trees efficiently', () => {
      const { createElementScope, onCleanup, disposeScope } = createTestEnv();

      const width = 100;
      const cleanups = Array.from({ length: width }, () => vi.fn());

      const rootScope = createElementScope(createMockElement(), () => {
        onCleanup(() => {});

        // Create many children
        for (let i = 0; i < width; i++) {
          createElementScope(createMockElement(), () => {
            onCleanup(cleanups[i]!);
          });
        }
      });

      disposeScope(rootScope!);

      // All children disposed
      cleanups.forEach(cleanup => expect(cleanup).toHaveBeenCalledOnce());
    });
  });
});
