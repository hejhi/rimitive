/**
 * Dependency snapshot utilities for DevTools
 * 
 * This module provides utilities for creating dependency snapshots
 * that capture the current state of the reactive graph.
 */

import type { DevToolsEvent, DependencyUpdateData } from '../types';
import type { TrackedSignal, TrackedComputed, TrackedEffect, PrimitiveRegistry } from '../tracking/registry';
import { getSubscribers, getDependencies, getCurrentValue } from '../dependency-utils';
import type { DependencyInfo } from '../dependency-utils';

/**
 * Create a dependency snapshot event
 */
export function getDependencySnapshot(
  primitive: TrackedSignal | TrackedComputed | TrackedEffect,
  trigger: 'created' | 'updated' | 'executed',
  registry: PrimitiveRegistry
): DevToolsEvent {
  let dependencies: DependencyInfo[] = [];
  let subscribers: DependencyInfo[] = [];

  // Get subscribers for signals and computed
  if (primitive.type === 'signal' || primitive.type === 'computed') {
    subscribers = getSubscribers(primitive.ref);
  }

  // Get dependencies for computed and effects
  if (primitive.type === 'computed' || primitive.type === 'effect') {
    dependencies = getDependencies(primitive.ref);
  }

  // Map dependency info to use our tracked IDs
  const mapDependencyInfo = (info: DependencyInfo): { id: string; name?: string } => {
    if (!info.ref) {
      // No ref means we can't map to tracked ID
      return { id: info.id, name: info.name };
    }
    
    // Try to get or register the primitive
    // Ensure type is valid before calling
    const primitiveType = info.type;
    if (primitiveType !== 'signal' && primitiveType !== 'computed' && primitiveType !== 'effect') {
      return { id: info.id, name: info.name };
    }
    
    const tracked = registry.getOrRegister(
      info.ref,
      primitive.contextId,
      primitiveType,
      info.name
    );
    
    return {
      id: tracked.id,
      name: tracked.name || info.name,
    };
  };

  const eventData: DependencyUpdateData = {
    id: primitive.id,
    type: primitive.type,
    trigger,
    dependencies: dependencies.map(mapDependencyInfo),
    subscribers: subscribers.map(mapDependencyInfo),
    value: primitive.type === 'signal' || primitive.type === 'computed'
      ? getCurrentValue(primitive.ref)
      : undefined,
  };

  return {
    type: 'DEPENDENCY_UPDATE',
    contextId: primitive.contextId,
    timestamp: Date.now(),
    data: eventData,
  };
}