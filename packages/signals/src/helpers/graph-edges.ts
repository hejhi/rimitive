import type { ProducerNode, ConsumerNode, Dependency, ToNode, FromNode } from '../types';

export interface GraphEdges {
  trackDependency: (producer: ProducerNode, consumer: ConsumerNode, version: number) => void;
  removeDependency: (dependency: Dependency) => Dependency | undefined;
}

export function createGraphEdges(): GraphEdges {
  const trackDependency = (
    producer: FromNode,
    consumer: ToNode,
    version: number
  ): void => {
    const tail = consumer.dependencyTail;
    
    if (tail && tail.producer === producer) return;
    
    // Tail will be undefined until after the first dependency in the executing consumer is read.
    // In that case, we should go with the first Dependency in the existing list.
    const candidate = tail ? tail.nextDependency : consumer.dependencies;

    if (candidate && candidate.producer === producer) {
      candidate.version = version;  // Update version when reusing dependency
      consumer.dependencyTail = candidate;
      return;
    }
    
    const prevDependent = producer.dependentsTail;

    const newDependency = {
      producer: producer,
      consumer: consumer,
      version: version,  // Use passed version instead of placeholder 0
      prevDependency: tail,
      prevDependent,
      nextDependency: candidate,
      nextDependent: undefined,
    };

    if (candidate) candidate.prevDependency = newDependency;
    if (tail) tail.nextDependency = newDependency;
    else consumer.dependencies = newDependency;

    consumer.dependencyTail = newDependency;

    if (prevDependent) prevDependent.nextDependent = newDependency;
    else producer.dependents = newDependency;

    producer.dependentsTail = newDependency;    
  };

  const removeDependency = (dependency: Dependency): Dependency | undefined => {
    const { producer, consumer, prevDependency, nextDependency, prevDependent, nextDependent } = dependency;

    if (nextDependency) nextDependency.prevDependency = prevDependency;
    else consumer.dependencyTail = prevDependency;

    if (prevDependency) prevDependency.nextDependency = nextDependency;
    else consumer.dependencies = nextDependency;

    if (nextDependent) nextDependent.prevDependent = prevDependent;
    else producer.dependentsTail = prevDependent;

    if (prevDependent) prevDependent.nextDependent = nextDependent;
    else producer.dependents = nextDependent;

    return nextDependency;
  };

  return { trackDependency, removeDependency };
}