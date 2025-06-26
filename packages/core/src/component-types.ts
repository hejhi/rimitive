/**
 * @fileoverview Shared types for component system
 */

import type { ComponentMiddleware } from './runtime-types';

/**
 * Marker interface that carries state type and middleware information
 */
export interface FromMarker<State> {
  _state: State;
  _initial: State;
  _middleware: ComponentMiddleware<State>[];
}