import type { ExecutionContext, ExecutionResult } from '../types';

/**
 * Execute user code in an isolated scope
 *
 * The code receives `svc` as the execution context with Rimitive primitives.
 * User code should return an element or null.
 *
 * Note: Each execution creates a fresh service context via createExecutionContext().
 * When the result is disposed (or a new execution runs), the element is removed from
 * the DOM but the reactive scopes from the previous context are orphaned. This is
 * acceptable because the old signals/effects aren't connected to the new context.
 */
export function executeUserCode(
  code: string,
  context: ExecutionContext
): ExecutionResult {
  try {
    // Wrap user code in a function that receives svc
    // The code should use destructuring: const { signal, el } = svc;
    // and return an element
    const wrappedCode = `
      "use strict";
      const svc = arguments[0];
      ${code}
    `;

    // Create and execute the function
    const fn = new Function(wrappedCode);
    const result = fn(context);

    // Handle the result
    if (result === undefined || result === null) {
      return { success: true, element: null, dispose: () => {} };
    }

    // Check if result is a RefSpec (has .create method)
    if (
      typeof result === 'object' &&
      'create' in result &&
      typeof result.create === 'function'
    ) {
      // Create the element from the RefSpec
      const ref = result.create();
      if (ref && 'element' in ref) {
        const element = ref.element as HTMLElement;
        return {
          success: true,
          element,
          dispose: () => {
            // Remove element from DOM if it has a parent
            element.parentNode?.removeChild(element);
          },
        };
      }
      return { success: true, element: null, dispose: () => {} };
    }

    // Check if result is already an HTMLElement
    if (result instanceof HTMLElement) {
      return {
        success: true,
        element: result,
        dispose: () => {
          result.parentNode?.removeChild(result);
        },
      };
    }

    // Unknown return type
    throw new Error(
      'Code must return an element (el(...)) or null. ' +
        `Got: ${typeof result}`
    );
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
