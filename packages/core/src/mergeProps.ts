import { PropsStore } from './types';

/**
 * Given props stores, creates an object keyed by their partNames
 *
 * @param {...PropsStore} items - Zustand stores with partName
 * @returns {Record<string, PropsStore>} Props lookup keyed by partName
 */
export function mergeProps(...items: PropsStore[]): Record<string, PropsStore> {
  if (!items || !items.length) return {};

  const result: Record<string, PropsStore> = {};

  // For each store, use its partName as the key
  for (const store of items) {
    if (store && typeof store.getState === 'function') {
      const partName = store.partName || store.getState().partName;

      if (!partName) {
        console.warn('Props store missing partName metadata');
        throw new Error('Props store missing partName metadata');
      }

      result[partName] = store;
    }
  }

  return result;
}
