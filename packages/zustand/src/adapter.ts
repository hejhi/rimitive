import type { ComponentFactory } from '@lattice/core';

/**
 * Create a Zustand store adapter that consumes Lattice component factories
 */
export function createZustandAdapter<
  TModel,
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>,
>(
  componentFactory: ComponentFactory<TModel, TSelectors, TActions, TViews>
): void {
  // Consume the component factory to get the Lattice instance with slice factories
  const lattice = componentFactory();
  
  // Extract the slice factories
  const modelFactory = lattice.getModel();
  const selectorsFactory = lattice.getSelectors();
  const actionsFactory = lattice.getActions();
  const viewFactories = lattice.getAllViews();
}

if (import.meta.vitest) {
  const { it, expect, describe, vi } = import.meta.vitest;

  describe('createZustandAdapter', () => {
    it('should consume a component factory and extract slice factories', () => {
      // Arrange
      const mockModelFactory = vi.fn();
      const mockSelectorsFactory = vi.fn();
      const mockActionsFactory = vi.fn();
      const mockViewFactory = vi.fn();
      
      const mockLattice = {
        getModel: vi.fn(() => mockModelFactory),
        getSelectors: vi.fn(() => mockSelectorsFactory),
        getActions: vi.fn(() => mockActionsFactory),
        getView: vi.fn((name: string) => mockViewFactory),
        getAllViews: vi.fn(() => ({ button: mockViewFactory })),
      };
      
      const mockComponentFactory = vi.fn(() => mockLattice) as any;

      // Act
      createZustandAdapter(mockComponentFactory);

      // Assert
      expect(mockComponentFactory).toHaveBeenCalledOnce();
      expect(mockLattice.getModel).toHaveBeenCalledOnce();
      expect(mockLattice.getSelectors).toHaveBeenCalledOnce();
      expect(mockLattice.getActions).toHaveBeenCalledOnce();
      expect(mockLattice.getAllViews).toHaveBeenCalledOnce();
    });
  });
}