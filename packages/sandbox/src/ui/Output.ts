import type { RefSpec } from '@rimitive/view/types';
import type { SandboxService } from '../service';
import type { ExecutionResult } from '../types';
import { ErrorDisplay } from './ErrorDisplay';

/**
 * Props for the Output component
 */
export type OutputProps = {
  /** Current execution result */
  result: () => ExecutionResult | null;
  /** Height of the output area */
  height?: string;
};

/**
 * Output component that displays the rendered result or error
 */
export const Output =
  (svc: SandboxService) =>
  (props: OutputProps): RefSpec<HTMLDivElement> => {
    const { el, effect } = svc;
    const { result, height = '100px' } = props;

    // Track previous result for cleanup
    let previousResult: ExecutionResult | null = null;

    return el('div')
      .props({
        className: 'sandbox-output',
        style: `height: ${height}; min-height: ${height === '100%' ? '0' : height};`,
      })
      .ref((container) => {
        // Update output when result changes
        const dispose = effect(() => {
          const currentResult = result();

          // Skip if no result yet (keep showing previous result while loading)
          if (!currentResult) {
            return;
          }

          // Dispose previous result's scopes before replacing
          if (
            previousResult &&
            previousResult.success &&
            previousResult.dispose
          ) {
            previousResult.dispose();
          }
          previousResult = currentResult;

          // Clear previous content
          container.innerHTML = '';

          if (!currentResult.success) {
            // Error - render error display
            const errorEl = ErrorDisplay(svc)({ error: currentResult.error });
            const errorRef = errorEl.create();
            if (errorRef.element) {
              container.appendChild(errorRef.element);
            }
            return;
          }

          if (currentResult.element) {
            // Success with element - append it
            container.appendChild(currentResult.element);
          } else {
            // Success but no element returned
            const noOutput = document.createElement('div');
            noOutput.className = 'sandbox-output__placeholder';
            noOutput.textContent =
              'Code executed successfully (no element returned)';
            container.appendChild(noOutput);
          }
        });

        return () => {
          // Cleanup on unmount
          if (
            previousResult &&
            previousResult.success &&
            previousResult.dispose
          ) {
            previousResult.dispose();
          }
          dispose();
        };
      })();
  };
