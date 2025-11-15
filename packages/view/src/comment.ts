/**
 * Comment node primitive for @lattice/view
 *
 * Creates comment nodes that can be used as markers in the DOM tree.
 * Renderer-agnostic - comment nodes are created by the renderer.
 */

import type { CommentRef, SealedSpec } from './types';
import { STATUS_COMMENT, STATUS_SEALED_SPEC } from './types';

/**
 * Create a comment node with the specified data
 *
 * @param data - The comment text content
 * @returns A SealedSpec that creates a CommentRef when instantiated
 *
 * @example
 * ```ts
 * const marker = comment('fragment-start');
 * ```
 */
export function comment(data: string): SealedSpec<CommentRef> {
  return {
    status: STATUS_SEALED_SPEC,
    create(): CommentRef {
      return {
        status: STATUS_COMMENT,
        data,
        next: undefined,
      };
    }
  };
}
