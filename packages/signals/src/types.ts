export interface BaseReactive { readonly __type: string; }

// Node: The base interface for all reactive graph nodes
export interface Node<T = unknown> extends BaseReactive {
  value: T;
  peek(): T;
}

// Producer: A Node that produces values and can be observed
export interface Producer<T = unknown> extends Node<T> {
  _targets?: Edge;
  _version: number;
  _lastEdge?: Edge;
}

// Consumer: A node that observes other nodes
export interface Consumer extends BaseReactive {
  _sources?: Edge;
  _invalidate(): void;
  _flags: number;
  dispose(): void;
}

// Edge: The connection between a Producer and Consumer in the dependency graph
export interface Edge {
  source: Producer | (Producer & Consumer);
  target: Consumer;
  prevSource?: Edge;
  nextSource?: Edge;
  prevTarget?: Edge;
  nextTarget?: Edge;
  version: number;
}

// ScheduledConsumer: A Consumer that can be scheduled for deferred execution
export interface ScheduledConsumer extends Consumer {
  _nextScheduled?: ScheduledConsumer;
  _flush(): void;
}
