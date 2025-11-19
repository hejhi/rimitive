/**
 * Tests for create() type inference
 */

import { describe, it, expect } from 'vitest';
import { create } from './component';
import type { RefSpec, SealedSpec } from './types';
import { STATUS_REF_SPEC, STATUS_SEALED_SPEC } from './types';

describe('create', () => {
  describe('type inference', () => {
    it('should preserve element type from RefSpec', () => {
      // Create a component that returns RefSpec<HTMLDivElement>
      const Component = create(() => () => {
        return {
          status: STATUS_REF_SPEC,
          create: () => ({ element: document.createElement('div') }),
        } as RefSpec<HTMLDivElement>;
      });

      // Runtime test
      const result = Component();
      expect(result.status).toBe(STATUS_SEALED_SPEC);

      // Type test - this should compile without errors
      const typeTest: SealedSpec<HTMLDivElement> = result;
      expect(typeTest).toBeDefined();

      // Also should be assignable to SealedSpec<object>
      const baseTypeTest: SealedSpec<object> = result;
      expect(baseTypeTest).toBeDefined();
    });

    it('should work with generic element types', () => {
      const Component = create(() => () => {
        return {
          status: STATUS_REF_SPEC,
          create: () => ({ element: document.createElement('span') }),
        } as RefSpec<HTMLElement>;
      });

      const result = Component();
      expect(result.status).toBe(STATUS_SEALED_SPEC);

      // Type test
      const typeTest: SealedSpec<HTMLElement> = result;
      expect(typeTest).toBeDefined();
    });

    it('should work with base element type (object)', () => {
      const Component = create(() => () => {
        return {
          status: STATUS_REF_SPEC,
          create: () => ({ element: {} }),
        } as RefSpec<object>;
      });

      const result = Component();
      expect(result.status).toBe(STATUS_SEALED_SPEC);

      // Type test - should be SealedSpec<object>
      const typeTest: SealedSpec<object> = result;
      expect(typeTest).toBeDefined();
    });
  });

  describe('runtime behavior', () => {
    it('should create component with arguments', () => {
      type MockApi = {
        value: number;
      };

      const Component = create((api: MockApi) => (multiplier: number) => {
        return {
          status: STATUS_REF_SPEC,
          create: () => ({ element: { result: api.value * multiplier } }),
        } as RefSpec<{ result: number }>;
      });

      const result = Component(5);
      expect(result.status).toBe(STATUS_SEALED_SPEC);

      const instance = result.create({ value: 10 } as MockApi);
      expect(instance.element).toEqual({ result: 50 });
    });

    it('should handle components with no arguments', () => {
      type MockApi = {
        createElement: () => HTMLElement;
      };

      const Component = create((api: MockApi) => () => {
        return {
          status: STATUS_REF_SPEC,
          create: () => ({ element: api.createElement() }),
        } as RefSpec<HTMLElement>;
      });

      const result = Component();
      expect(result.status).toBe(STATUS_SEALED_SPEC);

      const mockElement = document.createElement('div');
      const instance = result.create({ createElement: () => mockElement } as MockApi);
      expect(instance.element).toBe(mockElement);
    });
  });
});
