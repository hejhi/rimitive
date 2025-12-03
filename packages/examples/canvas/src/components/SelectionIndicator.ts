/**
 * SelectionIndicator Component
 *
 * A visual indicator (ring) that shows which shape is currently selected.
 * Uses match() to reactively show/hide based on selection state.
 */
import { canvas } from '../service';
import type { ShapeData } from '../behaviors/useShapeEditor';

const { circle, match } = canvas;

interface SelectionIndicatorProps {
  selectedShape: () => ShapeData | null;
}

/**
 * SelectionIndicator component
 *
 * Renders a white ring around the selected shape.
 * When no shape is selected, renders nothing (null).
 */
export const SelectionIndicator = (props: SelectionIndicatorProps) => {
  const { selectedShape } = props;

  return match(selectedShape, (shape) =>
    shape
      ? circle.props({
          x: shape.x,
          y: shape.y,
          radius: shape.size + 8,
          stroke: '#fff',
          strokeWidth: 2,
        })()
      : null
  );
};
