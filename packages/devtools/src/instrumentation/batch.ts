/**
 * Batch operation instrumentation for DevTools
 *
 * This module handles the instrumentation of batch operations
 * for tracking performance and graph snapshots.
 */

import type { LatticeContext } from '@lattice/lattice';
import type { PrimitiveRegistry } from '../tracking/registry';
import type { EventEmitter } from '../events/emitter';
import type { DevToolsOptions, GraphSnapshotData } from '../types';
import { ID_PREFIXES } from '../constants';
import { getDependencies, getCurrentValue } from '../dependency-utils';

/**
 * Options for batch instrumentation
 */
export interface BatchInstrumentationOptions {
  contextId: string;
  registry: PrimitiveRegistry;
  eventEmitter: EventEmitter;
  devToolsOptions: DevToolsOptions;
}

/**
 * Instrument a batch operation for DevTools tracking
 */
export function instrumentBatch(
  context: LatticeContext,
  fn: () => void,
  options: BatchInstrumentationOptions
): void {
  const batchId = `${ID_PREFIXES.BATCH}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Emit batch start event
  options.eventEmitter.emit({
    type: 'BATCH_START',
    contextId: options.contextId,
    timestamp: Date.now(),
    data: { id: batchId },
  });

  try {
    // Execute the batch
    context.batch(fn);

    // Emit batch end event
    options.eventEmitter.emit({
      type: 'BATCH_END',
      contextId: options.contextId,
      timestamp: Date.now(),
      data: {
        id: batchId,
        success: true,
      },
    });

    // Emit graph snapshot if enabled
    if (options.devToolsOptions.snapshotOnBatch !== false) {
      emitGraphSnapshot(options);
    }
  } catch (error) {
    // Emit batch end with error
    options.eventEmitter.emit({
      type: 'BATCH_END',
      contextId: options.contextId,
      timestamp: Date.now(),
      data: {
        id: batchId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}

/**
 * Emit a complete graph snapshot
 */
function emitGraphSnapshot(options: BatchInstrumentationOptions): void {
  const graphData = buildGraphSnapshot(options.contextId, options.registry);

  options.eventEmitter.emit({
    type: 'GRAPH_SNAPSHOT',
    contextId: options.contextId,
    timestamp: Date.now(),
    data: graphData,
  });
}

/**
 * Build a complete dependency graph snapshot
 */
function buildGraphSnapshot(
  contextId: string,
  registry: PrimitiveRegistry
): GraphSnapshotData {
  const nodes: GraphSnapshotData['nodes'] = [];
  const edges: GraphSnapshotData['edges'] = [];
  const edgeSet = new Set<string>(); // To avoid duplicate edges

  // Get all primitives for this context
  const primitives = registry.getContextPrimitives(contextId);

  // Create nodes
  for (const tracked of primitives) {
    if (tracked.type === 'selector') {
      // For selectors, include the selector function string as part of the name
      nodes.push({
        id: tracked.id,
        type: tracked.type,
        name: tracked.name || tracked.selector,
        value: undefined, // Selectors don't store values directly
        isActive: true,
      });

      // Add edge from source to selector
      const edgeKey = `${tracked.sourceId}->${tracked.id}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({
          source: tracked.sourceId,
          target: tracked.id,
          isActive: true,
        });
      }
    } else {
      nodes.push({
        id: tracked.id,
        type: tracked.type,
        name: tracked.name,
        value:
          tracked.type === 'signal' || tracked.type === 'computed'
            ? getCurrentValue(tracked.ref)
            : undefined,
        isActive: true,
      });

      // Build edges from dependencies
      if (tracked.type === 'computed' || tracked.type === 'effect') {
        const deps = getDependencies(tracked.ref);
        for (const dep of deps) {
          // Find the tracked primitive for this dependency
          const depTracked = dep.ref ? registry.get(dep.ref) : undefined;
          if (depTracked) {
            const edgeKey = `${depTracked.id}->${tracked.id}`;
            if (!edgeSet.has(edgeKey)) {
              edgeSet.add(edgeKey);
              edges.push({
                source: depTracked.id,
                target: tracked.id,
                isActive: true,
              });
            }
          }
        }
      }
    }
  }

  return { nodes, edges };
}
