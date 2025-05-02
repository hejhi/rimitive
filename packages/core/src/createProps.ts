import { create, StoreApi } from 'zustand';
import { PropsConfig, PropsState, PropsStore } from './types';

/**
 * Creates a props store with the given partName and config
 *
 * @param partName - The UI part name for the props
 * @param config - A function that returns the props config with get method
 * @returns A Zustand store with the props and partName metadata
 */
export function createProps<P = unknown>(
  partName: string,
  config: (
    set: StoreApi<PropsState<P>>['setState'],
    get: StoreApi<PropsState<P>>['getState'],
    api: StoreApi<PropsState<P>>
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
  const storeWithPartName = store as unknown as StoreApi<PropsState<P>> & {
    partName: string;
  };
  storeWithPartName.partName = partName;

  return storeWithPartName;
}
