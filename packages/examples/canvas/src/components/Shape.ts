/**
 * Shape Components - Canvas primitives using el()
 *
 * These components use the same el() pattern as DOM components,
 * but render to canvas nodes instead of DOM elements.
 *
 * Event handling is done at the canvas level via addEventListener,
 * not on individual shape nodes.
 *
 * Note: These return RefSpecs without the final () call so that
 * consumers can attach lifecycle callbacks for hit testing registration.
 */
import { canvas, computed } from '../service';
import type { ShapeData } from '../behaviors/useShapeEditor';

const { cvs } = canvas;

/**
 * Circle shape component
 *
 * Returns a RefSpec that can accept lifecycle callbacks.
 */
export const Circle = (shape: ShapeData) => {
  return cvs('circle', {
    x: shape.x,
    y: shape.y,
    radius: shape.size,
    fill: shape.color,
  })();
};

/**
 * Rect shape component
 *
 * Note: rect position is top-left corner, so we compute offset to center it.
 * Returns a RefSpec that can accept lifecycle callbacks.
 */
export const Rect = (shape: ShapeData) => {
  const halfSize = shape.size;

  return cvs('rect', {
    x: computed(() => shape.x() - halfSize),
    y: computed(() => shape.y() - halfSize),
    width: halfSize * 2,
    height: halfSize * 2,
    fill: shape.color,
    cornerRadius: 8,
  })();
};

/**
 * Shape factory - creates the appropriate shape component based on type
 *
 * Returns a RefSpec that can accept lifecycle callbacks.
 */
export const Shape = (shape: ShapeData) => {
  return shape.type === 'circle' ? Circle(shape) : Rect(shape);
};
