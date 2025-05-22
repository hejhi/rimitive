// React framework adapter implementation

import type { LatticeAPI } from '@lattice/core';
import * as React from 'react';

export interface ReactAdapter<TSelectors, TActions> {
  useSelectors: <TSelected>(selector: (selectors: TSelectors) => TSelected) => TSelected;
  useActions: () => TActions;
}

/**
 * Creates a React adapter for a Lattice component.
 * The returned hooks must be used within React components.
 */
export function createReactAdapter<
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
>(
  latticeAPI: LatticeAPI<TSelectors, TActions, TViews>
): ReactAdapter<TSelectors, TActions> {
  return {
    useSelectors: <TSelected>(selector: (selectors: TSelectors) => TSelected): TSelected => {
      // We need to handle both primitive and object return values
      // For objects, we need to ensure referential stability
      const [getSnapshot, getServerSnapshot] = React.useMemo(() => {
        let memoizedValue: TSelected;
        let memoizedSelectors: TSelectors | undefined;
        
        const computeSnapshot = () => {
          const currentSelectors = latticeAPI.getSelectors();
          
          // If selectors haven't changed, return memoized value
          if (memoizedSelectors === currentSelectors) {
            return memoizedValue;
          }
          
          // Compute new value
          const newValue = selector(currentSelectors);
          
          // For primitive values, we can return directly
          if (typeof newValue !== 'object' || newValue === null) {
            memoizedValue = newValue;
            memoizedSelectors = currentSelectors;
            return newValue;
          }
          
          // For objects, check if the value is actually different
          // This is a simple shallow equality check - could be enhanced
          const isEqual = memoizedValue && 
            typeof memoizedValue === 'object' &&
            Object.keys(newValue).length === Object.keys(memoizedValue).length &&
            Object.keys(newValue).every(key => 
              (newValue as any)[key] === (memoizedValue as any)[key]
            );
          
          if (!isEqual) {
            memoizedValue = newValue;
          }
          
          memoizedSelectors = currentSelectors;
          return memoizedValue;
        };
        
        return [computeSnapshot, computeSnapshot];
      }, [selector]);
      
      return React.useSyncExternalStore(
        latticeAPI.subscribe,
        getSnapshot,
        getServerSnapshot
      );
    },
    useActions: () => {
      return latticeAPI.getActions();
    },
  };
}