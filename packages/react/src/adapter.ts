// React framework adapter implementation

import type { LatticeAPI } from '@lattice/core';

export interface ReactAdapter<TSelectors, TActions> {
  useSelectors: <TSelected>(selector: (selectors: TSelectors) => TSelected) => TSelected;
  useActions: () => TActions;
}

export function createReactAdapter<
  TSelectors,
  TActions,
  TViews extends Record<string, unknown>
>(
  latticeAPI: LatticeAPI<TSelectors, TActions, TViews>
): ReactAdapter<TSelectors, TActions> {
  return {
    useSelectors: <TSelected>(selector: (selectors: TSelectors) => TSelected) => {
      // For now, just return the selected value directly
      // In a real implementation, this would use useSyncExternalStore
      return selector(latticeAPI.getSelectors());
    },
    useActions: () => {
      return latticeAPI.getActions();
    },
  };
}