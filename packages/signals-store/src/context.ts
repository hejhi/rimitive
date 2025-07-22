/**
 * @fileoverview Full-featured lattice context
 *
 * Provides a context with all signal features pre-configured.
 * For tree-shakeable builds, use createContext with individual extensions.
 */

import { signalExtension } from './extensions/signal';
import { computedExtension } from './extensions/computed';
import { effectExtension } from './extensions/effect';
import { batchExtension } from './extensions/batch';
import { selectExtension } from './extensions/select';
import { subscribeExtension } from './extensions/subscribe';

/**
 * All core extensions bundled together
 */
export const coreExtensions = [
  signalExtension,
  computedExtension,
  effectExtension,
  batchExtension,
  selectExtension,
  subscribeExtension,
] as const;
