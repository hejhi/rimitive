/**
 * Canvas Adapter - Reference Implementation
 *
 * This module demonstrates how to build a custom NodeAdapter for non-DOM targets.
 * The canvas adapter creates a scene graph that renders to an HTML canvas element
 * via the Canvas 2D API.
 *
 * Key concepts demonstrated:
 * - Implementing the Renderer (NodeAdapter) interface
 * - Bridge elements that connect different rendering contexts
 * - Scene graph management with parent/child relationships
 * - Dirty tracking and batched repainting
 * - Hit testing for interactive canvas applications
 *
 * This is meant as a learning resource and starting point for building custom
 * adapters. For production canvas applications, consider using established
 * libraries like Konva or PixiJS.
 */

export { createCanvasAdapter } from './adapter';
export { createCanvasAddEventListener } from './addEventListener';
export type {
  CanvasAdapterOptions,
  CanvasAdapterInstance,
} from './adapter';
export type { CanvasEventType } from './addEventListener';
export type {
  CanvasNode,
  CanvasBridgeElement,
  CanvasElement,
  CanvasAdapterConfig,
  CanvasPointerEvent,
  // Props types
  CanvasProps,
  GroupProps,
  RectProps,
  CircleProps,
  LineProps,
  PathProps,
  TextProps,
  ImageProps,
} from './types';
