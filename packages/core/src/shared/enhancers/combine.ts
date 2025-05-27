import type { Enhancer, EnhancerContext } from '../enhancers';

/**
 * Combine enhancer - combines multiple selector values into a single computed value
 */
export const combine: Enhancer<
  'combine',
  {
    <T1, T2, R>(
      selector1: () => T1,
      selector2: () => T2,
      combiner: (v1: T1, v2: T2) => R
    ): R;
    <T1, T2, T3, R>(
      selector1: () => T1,
      selector2: () => T2,
      selector3: () => T3,
      combiner: (v1: T1, v2: T2, v3: T3) => R
    ): R;
    <T1, T2, T3, T4, R>(
      selector1: () => T1,
      selector2: () => T2,
      selector3: () => T3,
      selector4: () => T4,
      combiner: (v1: T1, v2: T2, v3: T3, v4: T4) => R
    ): R;
  }
> = {
  name: 'combine' as const,
  create: (_context: EnhancerContext) => {
    // Return overloaded function
    function combineImpl(...args: any[]): any {
      const selectors = args.slice(0, -1);
      const combiner = args[args.length - 1];
      
      // Get values from all selectors
      const values = selectors.map(selector => selector());
      
      // Apply the combiner function
      return combiner(...values);
    }
    
    return combineImpl as any;
  },
};