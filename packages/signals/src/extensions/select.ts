/**
 * Select extension for lattice
 */
import type { LatticeExtension } from '@lattice/lattice';
import { select as selectImpl } from '../select';
import type { Signal, Computed, Selected } from '../types';

// Wrapper that handles Selected types
function selectWrapper<T, R>(
  source: Signal<T> | Computed<T> | Selected<T>,
  selector: (value: T) => R
): Selected<R> {
  // Check if source is a Selected type
  if ('select' in source && typeof source.select === 'function') {
    // Use the select method on the Selected object
    return source.select(selector);
  } else {
    // Use the original select function for Signal and Computed
    return selectImpl(source as Signal<T> | Computed<T>, selector);
  }
}

export const selectExtension: LatticeExtension<
  'select',
  <T, R>(source: Signal<T> | Computed<T> | Selected<T>, selector: (value: T) => R) => Selected<R>
> = {
  name: 'select',
  method: selectWrapper,
  
  wrap(selectFn, ctx) {
    return <T, R>(
      source: Signal<T> | Computed<T> | Selected<T>,
      selector: (value: T) => R
    ): Selected<R> => {
      if (ctx.isDisposed) {
        throw new Error('Cannot use select in disposed context');
      }
      
      return selectFn(source, selector);
    };
  }
};