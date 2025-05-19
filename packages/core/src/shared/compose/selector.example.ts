/**
 * Example demonstrating the selector pattern for property filtering
 * during composition. This shows how to use the new direct selector
 * pattern to filter properties when using factory functions.
 * 
 * NOTE: This is a demonstration file and not meant to be executed directly.
 * It shows the pattern for how the new selector functionality would be used.
 */

// Comment out actual imports to avoid type errors in this example file
/*
import { createModel } from '../../model/create';
import { createSelectors } from '../../selectors/create';
import { createActions } from '../../actions/create';
import { createView } from '../../view/create';
*/

// Type definitions to make the example clearer
type ModelExample = {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  doubled: () => number;
};

type SelectorsExample = {
  count: number;
  isPositive: boolean;
  doubled: number;
};

type ActionsExample = {
  increment: () => void;
  decrement: () => void;
  reset: () => void;
};

type ViewExample = {
  'data-count': number;
  'data-positive': boolean;
  'data-doubled': number;
  onClick: () => void;
  onReset: () => void;
};

// PATTERN EXAMPLE: Using the selector parameter to filter properties during composition

/**
 * Example 1: Filtering model properties
 * 
 * Instead of using compose().select() pattern:
 *   const filteredModel = compose(counterModel).select(({ reset, ...rest }) => rest);
 *
 * We can now directly pass a selector to the factory:
 *   const filteredModel = counterModel(({ reset, ...rest }) => rest);
 * 
 * This selects only the properties we want to keep from the model.
 */

/**
 * Example 2: Filtering selector properties
 * 
 * Instead of:
 *   const filteredSelectors = compose(counterSelectors).select(({ doubled, ...rest }) => rest);
 *
 * We can now use:
 *   const filteredSelectors = counterSelectors(({ doubled, ...rest }) => rest);
 */

/**
 * Example 3: Filtering action methods
 * 
 * Instead of:
 *   const filteredActions = compose(counterActions).select(({ reset, ...rest }) => rest);
 *
 * We can now use:
 *   const filteredActions = counterActions(({ reset, ...rest }) => rest);
 */

/**
 * Example 4: Filtering view attributes
 * 
 * Instead of:
 *   const filteredView = compose(counterView).select(({ 'data-doubled': _, ...rest }) => rest);
 *
 * We can now use:
 *   const filteredView = counterView(({ 'data-doubled': _, ...rest }) => rest);
 */

/**
 * Example 5: Using in composition
 * 
 * This pattern allows for cleaner composition by directly filtering at the callsite:
 * 
 * // In a component factory
 * createSelectors({ model }, ({ model }) => {
 *   // Filter the base selectors using the new pattern
 *   const base = baseSelectors(({ unwantedProp, ...rest }) => rest)({ get: () => ({}) });
 *   
 *   return {
 *     ...base,
 *     newProp: model().something
 *   };
 * });
 */

// This is just for demonstration - these won't be executed
export const examples = {
  // Examples of the pattern
  patternForModel: 'counterModel(({ reset, ...rest }) => rest)',
  patternForSelectors: 'counterSelectors(({ doubled, ...rest }) => rest)',
  patternForActions: 'counterActions(({ reset, ...rest }) => rest)',
  patternForView: 'counterView(({ \"data-doubled\": _, ...rest }) => rest)',
  
  // Example of composition
  compositionExample: `
    // Filter and compose in one step
    createSelectors({ model }, ({ model }) => {
      // Get filtered base selectors
      const base = baseSelectors(({ unwantedProp, ...rest }) => rest)({ get: () => ({}) });
      
      return {
        ...base,
        newProp: model().something
      };
    })
  `
};