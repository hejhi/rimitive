// Shared utility for two-phase contract enforcement in Lattice factories
// See: docs/draft-spec.md (Composition and Extension Function Pattern)

import type { TwoPhaseEnforcementProxy } from './types';

export function createTwoPhaseEnforcementProxy<Args extends unknown[], Result>(
  extensionPhaseFn: (...args: Args) => Result,
  factoryName: string
): TwoPhaseEnforcementProxy<Args, Result> {
  const handler: ProxyHandler<(...args: Args) => Result> = {
    get() {
      throw new Error(
        `Lattice: You must call the extension phase of ${factoryName}. ` +
          'See the Lattice spec: Composition and Extension Function Pattern.'
      );
    },
    set() {
      throw new Error(
        `Lattice: You must call the extension phase of ${factoryName}. ` +
          'See the Lattice spec: Composition and Extension Function Pattern.'
      );
    },
    apply(target, thisArg, argumentsList) {
      return Reflect.apply(target, thisArg, argumentsList);
    },
    construct() {
      throw new Error(
        `Lattice: You must call the extension phase of ${factoryName} as a function, not as a constructor. ` +
          'See the Lattice spec: Composition and Extension Function Pattern.'
      );
    },
    has() {
      throw new Error(
        `Lattice: You must call the extension phase of ${factoryName}. ` +
          'See the Lattice spec: Composition and Extension Function Pattern.'
      );
    },
    ownKeys() {
      throw new Error(
        `Lattice: You must call the extension phase of ${factoryName}. ` +
          'See the Lattice spec: Composition and Extension Function Pattern.'
      );
    },
    getOwnPropertyDescriptor() {
      throw new Error(
        `Lattice: You must call the extension phase of ${factoryName}. ` +
          'See the Lattice spec: Composition and Extension Function Pattern.'
      );
    },
  };
  return new Proxy(extensionPhaseFn, handler) as TwoPhaseEnforcementProxy<
    Args,
    Result
  >;
}
