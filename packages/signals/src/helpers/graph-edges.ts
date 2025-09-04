import type { ProducerNode, ConsumerNode, Dependency, ToNode, FromNode, DerivedNode } from '../types';
import { CONSTANTS, createFlagManager } from '../constants';

const { STATUS_DIRTY } = CONSTANTS;
const { setStatus } = createFlagManager()

export interface GraphEdges {
  trackDependency: (producer: ProducerNode, consumer: ConsumerNode) => void;
  removeDependency: (dependency: Dependency) => Dependency | undefined;
  detachAll: (consumer: ConsumerNode) => void;
  pruneStale: (consumer: ConsumerNode) => void;
}

export function createGraphEdges(): GraphEdges {
  const trackDependency = (
    producer: FromNode,
    consumer: ToNode
  ): void => {
    const tail = consumer.dependencyTail;
    
    if (tail && tail.producer === producer) return;
    
    // Tail will be undefined until after the first dependency in the executing consumer is read.
    // In that case, we should go with the first Dependency in the existing list.
    const candidate = tail ? tail.nextDependency : consumer.dependencies;

    if (candidate && candidate.producer === producer) {
      consumer.dependencyTail = candidate;
      return;
    }
    
    const prevDependent = producer.dependentsTail;

    const newDependency = {
      producer: producer,
      consumer: consumer,
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

  const isDerived = (source: FromNode | ToNode): source is DerivedNode => '_recompute' in source;

  const detachAll = (consumer: ConsumerNode): void => {
    let dependency = consumer.dependencies;
    
    while (dependency) {
      const producer = dependency.producer;
      const nextDependency = removeDependency(dependency);
      
      // Set DIRTY if we removed the last subscriber from a derived node
      if (!producer.dependents && isDerived(producer)) {
        producer.flags = setStatus(producer.flags, STATUS_DIRTY);
      }
      
      dependency = nextDependency;
    }
    
    consumer.dependencies = undefined;
    consumer.dependencyTail = undefined;
  };

  const pruneStale = (consumer: ConsumerNode): void => {
    const tail = consumer.dependencyTail;
    let toRemove = tail ? tail.nextDependency : consumer.dependencies;
    
    // No DIRTY setting during pruning - we're in mid-computation
    while (toRemove) toRemove = removeDependency(toRemove);

    if (tail) tail.nextDependency = undefined;
  };

  return { trackDependency, removeDependency, detachAll, pruneStale };
}