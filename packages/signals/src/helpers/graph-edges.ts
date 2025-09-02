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
    const tail = consumer._inTail;

    if (tail && tail.from === producer) return;

    const candidate = tail ? tail.nextIn : consumer._in;

    if (candidate && candidate.from === producer) {
      consumer._inTail = candidate;
      return;
    }
    
    const prevOut = producer._outTail;

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
    else consumer._in = newEdge;

    consumer._inTail = newEdge;

    if (prevOut) prevOut.nextOut = newEdge;
    else producer._out = newEdge;

    producer._outTail = newEdge;    
  };

  const removeEdge = (edge: Edge): Edge | undefined => {
    const { from, to, prevIn, nextIn, prevOut, nextOut } = edge;

    if (nextIn) nextIn.prevIn = prevIn;
    else to._inTail = prevIn;

    if (prevIn) prevIn.nextIn = nextIn;
    else to._in = nextIn;

    if (nextOut) nextOut.prevOut = prevOut;
    else from._outTail = prevOut;

    if (prevOut) prevOut.nextOut = nextOut;
    else {
      from._out = nextOut;
      if (!nextOut && isDerived(from)) from._flags = setStatus(from._flags, STATUS_DIRTY);
    }

    return nextIn;
  };

  const isDerived = (source: FromNode | ToNode): source is DerivedNode => '_recompute' in source;

  const detachAll = (consumer: ConsumerNode): void => {
    let edge = consumer._in;
    
    if (edge) {
      do {
        edge = removeEdge(edge);
      } while (edge);
    }
    
    consumer._in = undefined;
    consumer._inTail = undefined;
  };

  const pruneStale = (consumer: ConsumerNode): void => {
    const tail = consumer._inTail;
    
    let toRemove = tail ? tail.nextIn : consumer._in;
    
    if (toRemove) {
      do {
        toRemove = removeEdge(toRemove);
      } while (toRemove);
    }

    if (tail) tail.nextIn = undefined;
  };

  return { addEdge, removeEdge, detachAll, pruneStale };
}