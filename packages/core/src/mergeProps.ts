/**
 * Given props stores, creates an object keyed by their partNames
 *
 * @param {...any} items - Zustand stores with partName
 * @returns {object} Props lookup keyed by partName
 */
export function mergeProps(...items: any[]): Record<string, any> {
  if (!items || !items.length) return {};

  const result: Record<string, any> = {};

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
