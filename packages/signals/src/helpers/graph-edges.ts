import type { ProducerNode, ConsumerNode, Edge, ToNode, FromNode, DerivedNode } from '../types';
import { CONSTANTS } from '../constants';
import { createNodeState } from './node-state';

const { STATUS_DIRTY } = CONSTANTS;
const { setStatus } = createNodeState()

export interface GraphEdges {
  addEdge: (producer: ProducerNode, consumer: ConsumerNode) => void;
  removeEdge: (edge: Edge) => Edge | undefined;
  detachAll: (consumer: ConsumerNode) => void;
  pruneStale: (consumer: ConsumerNode) => void;
}

export function createGraphEdges(): GraphEdges {
  const addEdge = (
    producer: FromNode,
    consumer: ToNode
  ): void => {
    const tail = consumer.inTail;

    if (tail && tail.from === producer) return;

    const candidate = tail ? tail.nextIn : consumer.in;

    if (candidate && candidate.from === producer) {
      consumer.inTail = candidate;
      return;
    }
    
    const prevOut = producer.outTail;

    const newEdge = {
      from: producer,
      to: consumer,
      prevIn: tail,
      prevOut,
      nextIn: candidate,
      nextOut: undefined,
    };

    if (candidate) candidate.prevIn = newEdge;
    if (tail) tail.nextIn = newEdge;
    else consumer.in = newEdge;

    consumer.inTail = newEdge;

    if (prevOut) prevOut.nextOut = newEdge;
    else producer.out = newEdge;

    producer.outTail = newEdge;    
  };

  const removeEdge = (edge: Edge): Edge | undefined => {
    const { from, to, prevIn, nextIn, prevOut, nextOut } = edge;

    if (nextIn) nextIn.prevIn = prevIn;
    else to.inTail = prevIn;

    if (prevIn) prevIn.nextIn = nextIn;
    else to.in = nextIn;

    if (nextOut) nextOut.prevOut = prevOut;
    else from.outTail = prevOut;

    if (prevOut) prevOut.nextOut = nextOut;
    else from.out = nextOut;

    return nextIn;
  };

  const isDerived = (source: FromNode | ToNode): source is DerivedNode => '_recompute' in source;

  const detachAll = (consumer: ConsumerNode): void => {
    let edge = consumer.in;
    
    if (edge) {
      do {
        const from = edge.from;
        const nextEdge = removeEdge(edge);
        
        // Set DIRTY if we removed the last subscriber from a derived node
        if (!from.out && isDerived(from)) {
          from.flags = setStatus(from.flags, STATUS_DIRTY);
        }
        
        edge = nextEdge;
      } while (edge);
    }
    
    consumer.in = undefined;
    consumer.inTail = undefined;
  };

  const pruneStale = (consumer: ConsumerNode): void => {
    const tail = consumer.inTail;
    
    let toRemove = tail ? tail.nextIn : consumer.in;
    
    if (toRemove) {
      do {
        // No DIRTY setting during pruning - we're in mid-computation
        toRemove = removeEdge(toRemove);
      } while (toRemove);
    }

    if (tail) tail.nextIn = undefined;
  };

  return { addEdge, removeEdge, detachAll, pruneStale };
}