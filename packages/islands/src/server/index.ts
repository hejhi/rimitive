/**
 * Server Module
 *
 * Re-exports SSR primitives for server-side rendering with islands.
 */

export {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '../ssr-context';
export type { SSRContext } from '../types';

export { renderToString } from '../helpers/renderToString';
