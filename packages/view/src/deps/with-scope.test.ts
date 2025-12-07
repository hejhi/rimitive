import { describe, it, expect, vi } from 'vitest';
import { createTestScopes, createMockElement } from '../test-helpers';

/**
 * Tests for createElementScope behavior
 *
 * These tests verify the public API behavior:
 * - Scope creation and registration
 * - Hierarchy management
 * - Idempotent behavior
 * - Integration with cleanup tracking
 */

describe('createElementScope', () => {
  describe('scope creation and registration', () => {
    it('does not register scope when no disposables are added', () => {
      const { createElementScope, getElementScope } = createTestScopes();
      const element = createMockElement();

      let didRun = false;
      const scope = createElementScope(element, () => {
        didRun = true;
      });

      expect(didRun).toBe(true);
      expect(scope).toBeNull(); // No scope created when no disposables

      // Scope should NOT be registered (performance optimization)
      expect(getElementScope(element)).toBeUndefined();
    });

    it('registers scope when disposables are added', () => {
      const { createElementScope, onCleanup, getElementScope } =
        createTestScopes();
      const element = createMockElement();

      const scope = createElementScope(element, () => {
        onCleanup(() => {});
      });

      // Scope should be created and registered
      expect(scope).toBeTruthy();
      expect(getElementScope(element)).toBe(scope);
    });
  });

  describe('scope hierarchy', () => {
    it('creates parent-child hierarchy when nested', () => {
      const { createElementScope, onCleanup, disposeScope } =
        createTestScopes();

      const parentElement = createMockElement();
      const childElement = createMockElement();

      const parentCleanup = vi.fn();
      const childCleanup = vi.fn();

      const parentScope = createElementScope(parentElement, () => {
        onCleanup(parentCleanup);

        // Create child within parent
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

    it('handles multiple levels of nesting', () => {
      const { createElementScope, onCleanup } = createTestScopes();

      let nestedCallCount = 0;

      const rootScope = createElementScope(createMockElement(), () => {
        onCleanup(() => {});
        nestedCallCount++;

        createElementScope(createMockElement(), () => {
          onCleanup(() => {});
          nestedCallCount++;

          createElementScope(createMockElement(), () => {
            onCleanup(() => {});
            nestedCallCount++;
          });
        });
      });

      expect(rootScope).toBeTruthy();
      expect(nestedCallCount).toBe(3);
    });
  });

  describe('scope reuse', () => {
    it('can look up existing scope from element', () => {
      const { createElementScope, onCleanup, getElementScope } =
        createTestScopes();
      const element = createMockElement();

      // First call creates scope
      const scope1 = createElementScope(element, () => {
        onCleanup(() => {});
      });

      // Scope is registered
      expect(scope1).toBeTruthy();
      expect(getElementScope(element)).toBe(scope1);

      // Can retrieve the same scope from the map
      const retrievedScope = getElementScope(element);
      expect(retrievedScope).toBe(scope1);
    });
  });

  describe('integration with effects', () => {
    it('enables automatic disposal tracking pattern', () => {
      const {
        createElementScope,
        scopedEffect,
        disposeScope,
        getElementScope,
      } = createTestScopes();

      const element = createMockElement();
      const effectCleanup = vi.fn();

      // Create scope with effect
      const scope = createElementScope(element, () => {
        scopedEffect(() => effectCleanup);
      });

      expect(scope).toBeTruthy();
      expect(getElementScope(element)).toBe(scope);

      // Dispose the scope
      disposeScope(scope!);

      expect(effectCleanup).toHaveBeenCalledOnce();
    });
  });
});
