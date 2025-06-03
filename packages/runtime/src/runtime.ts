import type { AdapterAPI, SliceFactory } from '@lattice/core';
import type { RuntimeFactory } from './types.js';

/**
 * Creates a Lattice runtime that provides a createAPI function to adapters.
 * 
 * The runtime's role is minimal - it just provides a way for adapters to
 * create their API objects. In the future, this could be enhanced to apply
 * transformations, but for now it's a simple pass-through.
 * 
 * @param adapterFactory - Function that uses createAPI to build an adapter result
 * @returns The result of calling the adapter factory
 */
export function createRuntime<Result>(
  adapterFactory: RuntimeFactory<Result>
): Result {
  // For now, createAPI is a simple pass-through
  // In the future, this could apply enhancements
  const createAPI = <Model>(implementations: AdapterAPI<Model>): AdapterAPI<Model> => {
    return implementations;
  };
  
  return adapterFactory(createAPI);
}

if (import.meta.vitest) {
  const { describe, it, expect, vi } = import.meta.vitest;

  describe('createRuntime', () => {
    it('should provide createAPI to adapter factory', () => {
      const mockExecuteSlice = vi.fn();
      const mockGetState = vi.fn().mockReturnValue({ count: 0 });
      
      const implementations: AdapterAPI<{ count: number }> = {
        executeSlice: mockExecuteSlice,
        getState: mockGetState
      };
      
      const result = createRuntime((createAPI) => {
        const api = createAPI(implementations);
        
        expect(api).toBeDefined();
        expect(api.executeSlice).toBe(implementations.executeSlice);
        expect(api.getState).toBe(implementations.getState);
        
        return 'success';
      });
      
      expect(result).toBe('success');
    });

    it('should support self-referential APIs', () => {
      interface TestModel { value: number; }
      
      const result = createRuntime((createAPI) => {
        let apiRef: AdapterAPI<TestModel>;
        
        const api = createAPI<TestModel>({
          executeSlice: <T>(slice: SliceFactory<TestModel, T>): T => {
            // Can access apiRef here
            expect(apiRef).toBeDefined();
            return slice({ value: 0 }, apiRef);
          },
          getState: () => ({ value: 0 })
        });
        
        apiRef = api;
        
        // Test it works
        const testSlice = vi.fn().mockReturnValue('test');
        const sliceResult = api.executeSlice(testSlice);
        
        expect(testSlice).toHaveBeenCalledWith({ value: 0 }, api);
        expect(sliceResult).toBe('test');
        return api;
      });
      
      expect(result).toBeDefined();
    });
  });
}