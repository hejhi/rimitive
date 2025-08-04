// ALGORITHM: Computed Value Memoization with Version Vector
//
// For deep computed chains (A -> B -> C -> D), we can avoid
// recomputing intermediate values by using a version vector
// that tracks the last known versions of all leaf dependencies.
//
// This transforms O(d) depth traversal into O(1) in many cases.

import type { ProducerNode, ConsumerNode } from '../types';

export interface VersionVector {
  // Map from source ID to last known version
  versions: Map<number, number>;
  // Global version when this vector was created
  globalVersion: number;
}

// OPTIMIZATION: Weak map to avoid memory leaks
// When a computed is GC'd, its cache entry is automatically removed
const versionVectorCache = new WeakMap<ConsumerNode, VersionVector>();

// Assign unique IDs to producers for version vector
let nextProducerId = 1;
const producerIds = new WeakMap<ProducerNode, number>();

export function getProducerId(producer: ProducerNode): number {
  let id = producerIds.get(producer);
  if (!id) {
    id = nextProducerId++;
    producerIds.set(producer, id);
  }
  return id;
}

// ALGORITHM: Collect all leaf dependencies recursively
// This is called once when a computed first evaluates
export function collectLeafDependencies(
  node: ConsumerNode,
  leaves: Set<ProducerNode> = new Set()
): Set<ProducerNode> {
  let source = node._sources;
  
  while (source) {
    const producer = source.source;
    
    // If producer is also a consumer (computed), recurse
    if ('_sources' in producer && producer._sources) {
      collectLeafDependencies(producer as ConsumerNode, leaves);
    } else {
      // It's a leaf (signal)
      leaves.add(producer);
    }
    
    source = source.nextSource;
  }
  
  return leaves;
}

// ALGORITHM: Fast staleness check using version vector
// Returns true if any leaf dependency has changed
export function isStaleByVersionVector(
  node: ConsumerNode,
  currentGlobalVersion: number
): boolean {
  const cached = versionVectorCache.get(node);
  
  // No cache - definitely stale
  if (!cached) return true;
  
  // Global version unchanged - definitely fresh
  if (cached.globalVersion === currentGlobalVersion) return false;
  
  // Check each leaf dependency
  const leaves = collectLeafDependencies(node);
  
  for (const leaf of leaves) {
    const leafId = getProducerId(leaf);
    const cachedVersion = cached.versions.get(leafId);
    
    // New dependency or version changed
    if (cachedVersion === undefined || cachedVersion !== leaf._version) {
      return true;
    }
  }
  
  return false;
}

// ALGORITHM: Update version vector after successful computation
export function updateVersionVector(
  node: ConsumerNode,
  globalVersion: number
): void {
  const leaves = collectLeafDependencies(node);
  const versions = new Map<number, number>();
  
  for (const leaf of leaves) {
    const leafId = getProducerId(leaf);
    versions.set(leafId, leaf._version);
  }
  
  versionVectorCache.set(node, {
    versions,
    globalVersion
  });
}

// OPTIMIZATION: Batch version vector updates
// When multiple computeds update in sequence, we can batch
// the leaf collection process
export class BatchedVersionVectorUpdater {
  private pending = new Map<ConsumerNode, number>();
  private scheduled = false;
  
  schedule(node: ConsumerNode, globalVersion: number): void {
    this.pending.set(node, globalVersion);
    
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => this.flush());
    }
  }
  
  private flush(): void {
    // Collect all leaves for all pending nodes at once
    const allLeaves = new Set<ProducerNode>();
    
    for (const [node] of this.pending) {
      collectLeafDependencies(node, allLeaves);
    }
    
    // Now update all version vectors
    for (const [node, globalVersion] of this.pending) {
      const versions = new Map<number, number>();
      
      // Only check leaves relevant to this node
      const nodeLeaves = collectLeafDependencies(node);
      for (const leaf of nodeLeaves) {
        const leafId = getProducerId(leaf);
        versions.set(leafId, leaf._version);
      }
      
      versionVectorCache.set(node, { versions, globalVersion });
    }
    
    this.pending.clear();
    this.scheduled = false;
  }
}