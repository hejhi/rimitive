/**
 * Slice utilities for composition
 * 
 * These utilities help with slice-based composition, allowing components
 * to selectively include properties from the base component.
 */

/**
 * Slice tools interface for composition callbacks
 * 
 * This interface defines the standard parameters that are passed to with() callbacks
 * in composition functions. Each component type will extend this with specific tools.
 */
export interface SliceTools<TBase> {
  /**
   * The slice parameter provides access to all properties of the base component
   * This allows selective inclusion, renaming, or filtering of properties
   */
  slice: TBase;
}

/**
 * ModelSliceTools provides tools specific to model composition
 */
export interface ModelSliceTools<TBase, TModel> extends SliceTools<TBase> {
  get: () => TModel;
  set: (state: Partial<TModel> | ((state: TModel) => Partial<TModel>)) => void;
}

/**
 * SelectorsSliceTools provides tools specific to selectors composition
 */
export interface SelectorsSliceTools<TBase, TModel> extends SliceTools<TBase> {
  getModel: () => TModel;
}

/**
 * ActionsSliceTools provides tools specific to actions composition
 */
export interface ActionsSliceTools<TBase> extends SliceTools<TBase> {
  mutate: <M>(model: M) => any;
}

/**
 * ViewSliceTools provides tools specific to view composition
 */
export interface ViewSliceTools<TBase, TSelectors, TActions> extends SliceTools<TBase> {
  getSelectors: () => TSelectors;
  getActions: () => TActions;
}

/**
 * Tests for slice helpers
 */
if (import.meta.vitest) {
  const { it, expect, describe } = import.meta.vitest;

  describe('slice', () => {
    it('should define the SliceTools interface', () => {
      // Type-level test only, no runtime assertions needed
      const mockSliceTools: SliceTools<{ count: number }> = {
        slice: { count: 42 }
      };
      
      expect(mockSliceTools.slice.count).toBe(42);
    });

    it('should define the ModelSliceTools interface', () => {
      // Type-level test only, no runtime assertions needed
      const mockGet = () => ({ count: 42 });
      const mockSet = () => {};
      
      const mockModelTools: ModelSliceTools<{ increment: () => void }, { count: number }> = {
        slice: { increment: () => {} },
        get: mockGet,
        set: mockSet
      };
      
      expect(mockModelTools.slice.increment).toBeInstanceOf(Function);
      expect(mockModelTools.get().count).toBe(42);
      expect(mockModelTools.set).toBeInstanceOf(Function);
    });
  });
}