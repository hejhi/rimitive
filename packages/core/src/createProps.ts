import { create, StoreApi } from 'zustand';

/**
 * Type for props configuration
 */
export interface PropsConfig<P = any> {
  get: (params: P) => Record<string, any>;
}

/**
 * Type for a props store state
 */
export interface PropsState<P = any> {
  partName: string;
  get: (params: P) => Record<string, any>;
}

/**
 * Type for a props store with partName metadata
 */
export type PropsStore<P = any> = StoreApi<PropsState<P>> & {
  partName: string;
};

/**
 * Creates a props store with the given partName and config
 *
 * @param partName - The UI part name for the props
 * @param config - A function that returns the props config with get method
 * @returns A Zustand store with the props and partName metadata
 */
export function createProps<P = any>(
  partName: string,
  config: (
    set: StoreApi<any>['setState'],
    get: StoreApi<any>['getState'],
    api: StoreApi<any>
  ) => PropsConfig<P>
): PropsStore<P> {
  // Create the store with the config, ensuring partName is included in the state
  const store = create<PropsState<P>>((set, get, api) => {
    // Initialize the state with the user config
    const initialState = config(set, get, api);

    // Return state with partName and user config
    return {
      ...initialState,
      partName, // This will override any partName in initialState if present
    };
  });

  // Add partName to the store object itself for access without getState
  const storeWithPartName = store as unknown as PropsStore<P>;
  storeWithPartName.partName = partName;

  return storeWithPartName;
}
