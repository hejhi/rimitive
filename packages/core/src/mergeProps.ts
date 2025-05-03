import { PropsStore } from './types';

/**
 * Given props stores, creates an object keyed by their partNames
 *
 * @param items - Zustand stores with partName
 * @returns Props lookup keyed by partName
 */
export function mergeProps(
  ...items: PropsStore<any, any>[]
): Record<string, PropsStore<any, any>> {
  if (!items || !items.length) return {};

  const result: Record<string, PropsStore<any, any>> = {};

  // For each store, use its partName as the key
  for (const store of items) {
    if (store && typeof store.getState === 'function') {
      // Get partName from store or from its state
      const partName: string = store.partName || store.getState().partName;

      if (!partName) {
        console.warn('Props store missing partName metadata');
        throw new Error('Props store missing partName metadata');
      }

      result[partName] = store;
    }
  }

  return result;
}
