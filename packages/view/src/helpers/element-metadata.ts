/**
 * WeakMaps for storing element metadata without polluting DOM nodes
 *
 * This module provides a clean way to associate metadata with DOM elements
 * without adding properties directly to the elements themselves.
 */

import type { LifecycleCallback } from '../types';
import type { Scope } from './scope';

/**
 * Store element scopes
 */
export const elementScopes = new WeakMap<object, Scope>();

/**
 * Store element dispose callbacks
 */
export const elementDisposeCallbacks = new WeakMap<object, () => void>();

/**
 * Store element lifecycle callbacks
 */
export const elementLifecycleCallbacks = new WeakMap<object, LifecycleCallback>();

/**
 * Store element cleanup callbacks (returned from lifecycle callbacks)
 */
export const elementCleanupCallbacks = new WeakMap<object, () => void>();
