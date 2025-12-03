/**
 * Island Factory
 *
 * Provides typed island factory for defining interactive components.
 */
import { createIsland } from '@lattice/islands/factory';
import type { IslandAPI } from '@lattice/islands/presets/islands.server';

/**
 * Typed island factory
 */
export const island = createIsland<IslandAPI>();
