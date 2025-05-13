/**
 * Lattice composition utilities.
 *
 * This module provides utility functions for composing lattices by
 * extracting and reusing components from existing lattices.
 */

import { describe, it, expect, vi } from 'vitest';
import { Lattice } from './types';

/**
 * Utility to extract a component from a lattice.
 * 
 * This function allows users to reuse components from an existing lattice
 * when creating new lattices.
 * 
 * @param lattice - The lattice to extract from
 * @param componentType - The type of component to extract ('model', 'state', 'actions')
 * @returns The requested component from the lattice
 * 
 * @example
 * ```typescript
 * const baseState = use(baseLattice, 'state');
 * ```
 */
export function use<L extends Lattice, K extends keyof L>(lattice: L, componentType: K): L[K];

/**
 * Utility to extract a view by namespace from a lattice.
 * 
 * This function allows users to reuse views from an existing lattice
 * when creating new lattices.
 * 
 * @param lattice - The lattice to extract from
 * @param componentType - Must be 'view' to extract from views
 * @param namespace - The namespace of the view to extract
 * @returns The requested view from the lattice
 * 
 * @example
 * ```typescript
 * const baseView = use(baseLattice, 'view', 'namespace');
 * ```
 */
export function use<L extends Lattice, N extends keyof L['view']>(
  lattice: L,
  componentType: 'view',
  namespace: N
): L['view'][N];

// Implementation
export function use(lattice: Lattice, componentType: string, namespace?: string): unknown {
  if (!lattice) {
    throw new Error('Lattice must be provided');
  }
  
  if (componentType === 'view' && namespace) {
    if (!(namespace in lattice.view)) {
      throw new Error(`View namespace '${namespace}' not found in lattice`);
    }
    return lattice.view[namespace];
  }
  
  if (!(componentType in lattice)) {
    throw new Error(`Component type '${componentType}' not found in lattice`);
  }
  
  return lattice[componentType as keyof Lattice];
}

/**
 * Utility to extract all views from a lattice.
 * 
 * This function allows users to reuse all views from an existing lattice
 * when creating new lattices.
 * 
 * @param lattice - The lattice to extract views from
 * @returns All views from the lattice
 * 
 * @example
 * ```typescript
 * const combinedViews = {
 *   ...spreadViews(baseLattice),
 *   newView: preparedNewView
 * };
 * ```
 */
export function spreadViews<L extends Lattice>(lattice: L): L['view'] {
  if (!lattice || !lattice.view) {
    throw new Error('Lattice with view property must be provided');
  }
  
  return { ...lattice.view };
}

// In-source tests
if (import.meta.vitest) {
  describe('Lattice composition utilities', () => {
    describe('use function', () => {
      it('should extract components from a lattice', () => {
        // Mock lattice
        const mockLattice = {
          name: 'test',
          model: { modelProp: 'modelValue' },
          state: { stateProp: 'stateValue' },
          actions: { actionMethod: vi.fn() },
          view: {
            namespace1: { viewProp1: 'viewValue1' },
            namespace2: { viewProp2: 'viewValue2' }
          }
        } as unknown as Lattice;
        
        // Extract components
        const model = use(mockLattice, 'model');
        const state = use(mockLattice, 'state');
        const actions = use(mockLattice, 'actions');
        const view1 = use(mockLattice, 'view', 'namespace1');
        
        // Verify extraction
        expect(model).toBe(mockLattice.model);
        expect(state).toBe(mockLattice.state);
        expect(actions).toBe(mockLattice.actions);
        expect(view1).toBe(mockLattice.view.namespace1);
      });
      
      it('should throw when extracting non-existent components', () => {
        const mockLattice = {
          name: 'test',
          model: {},
          state: {},
          actions: {},
          view: { namespace1: {} }
        } as unknown as Lattice;
        
        // Try to extract non-existent component
        expect(() => use(mockLattice, 'nonExistent' as any)).toThrow();
        
        // Try to extract non-existent view namespace
        expect(() => use(mockLattice, 'view', 'nonExistent' as any)).toThrow();
      });
    });
    
    describe('spreadViews function', () => {
      it('should spread all views from a lattice', () => {
        const mockLattice = {
          name: 'test',
          model: {},
          state: {},
          actions: {},
          view: {
            namespace1: { prop1: 'value1' },
            namespace2: { prop2: 'value2' }
          }
        } as unknown as Lattice;
        
        // Spread all views
        const views = spreadViews(mockLattice);
        
        // Create a new view object with some additional views
        const combinedViews = {
          ...views,
          namespace3: { prop3: 'value3' }
        };
        
        // Verify the combined views
        expect(combinedViews).toHaveProperty('namespace1');
        expect(combinedViews).toHaveProperty('namespace2');
        expect(combinedViews).toHaveProperty('namespace3');
        expect(combinedViews.namespace1).toBe(mockLattice.view.namespace1);
        expect(combinedViews.namespace2).toBe(mockLattice.view.namespace2);
        expect(combinedViews.namespace3).toEqual({ prop3: 'value3' });
      });
      
      it('should throw for invalid lattices', () => {
        expect(() => spreadViews(null as any)).toThrow();
        expect(() => spreadViews({} as any)).toThrow();
        expect(() => spreadViews({ view: null } as any)).toThrow();
      });
    });
  });
}