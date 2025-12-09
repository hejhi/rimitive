/**
 * @lattice/islands - Islands Architecture for Server-Side Rendering
 *
 * Provides fine-grained hydration for Lattice applications.
 * Only interactive components ("islands") ship JavaScript to the client.
 *
 * ## Import Guide
 *
 * | Use Case | Import |
 * |----------|--------|
 * | Define islands | `import { island } from '@lattice/islands'` |
 * | Server utilities | `import { ... } from '@lattice/islands/server'` |
 * | Client hydration | `import { ... } from '@lattice/islands/client'` |
 */

// Base island function
export { island } from './island';

// Core types
export type { IslandComponent, IslandStrategy, IslandMetaData } from './types';

export { HydrationMismatch, ISLAND_META } from './types';
