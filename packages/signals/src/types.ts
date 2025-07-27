// Base for all reactive nodes
export interface ReactiveNode {
  readonly __type: string;
}

// Public-facing interfaces
export interface ReadableNode<T = unknown> extends ReactiveNode {
  readonly value: T;
  peek(): T;
}

export interface WritableNode<T = unknown> extends ReadableNode<T> {
  value: T;
}

export interface DisposableNode {
  dispose(): void;
}

// Internal implementation interfaces
export interface ProducerNode extends ReactiveNode {
  _targets: Edge | undefined;
  _version: number;
}

export interface ConsumerNode extends ReactiveNode {
  _sources: Edge | undefined;
  _invalidate(): void;
}

// A Consumer that can be scheduled for deferred execution
export interface ScheduledNode extends ConsumerNode, DisposableNode {
  _nextScheduled?: ScheduledNode;
  _flush(): void;
}

export interface StatefulNode extends ConsumerNode {
  _flags: number;
}

// The connection between a Producer and Consumer in the dependency graph
export interface Edge {
  source: ProducerNode | (ProducerNode & ConsumerNode);
  target: ConsumerNode;
  prevSource?: Edge;
  nextSource?: Edge;
  prevTarget?: Edge;
  nextTarget?: Edge;
  version: number;
}

