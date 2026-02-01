import type { RefSpec } from '@rimitive/view/types';
import type { SandboxService } from '../service';

/**
 * Props for the ErrorDisplay component
 */
export type ErrorDisplayProps = {
  /** The error to display */
  error: Error;
};

/**
 * Format stack trace for display
 */
function formatStackTrace(stack: string): string {
  // Remove the error message line (first line) as we display it separately
  const lines = stack.split('\n');
  return lines.slice(1).join('\n').trim();
}

/**
 * ErrorDisplay component for showing execution errors
 */
export const ErrorDisplay =
  ({ el }: SandboxService) =>
  (props: ErrorDisplayProps): RefSpec<HTMLDivElement> => {
    const { error } = props;

    return el('div').props({
      className: 'sandbox-error',
    })(
      // Error header
      el('div').props({
        className: 'sandbox-error__header',
      })(el('span')('Error')),

      // Error message
      el('div').props({
        className: 'sandbox-error__message',
      })(error.message),

      // Stack trace (if available)
      ...(error.stack
        ? [
            el('details').props({
              className: 'sandbox-error__details',
            })(
              el('summary').props({
                className: 'sandbox-error__summary',
              })('Stack trace'),
              el('pre').props({
                className: 'sandbox-error__stack',
              })(formatStackTrace(error.stack))
            ),
          ]
        : [])
    );
  };
