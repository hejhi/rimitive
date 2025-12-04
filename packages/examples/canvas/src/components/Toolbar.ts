/**
 * Toolbar Component (DOM)
 *
 * Uses the DOM renderer for UI controls.
 * Shares signals with the canvas scene.
 */
import { dom } from '../service';
import type { ShapeType } from '../behaviors/useShapeEditor';

const { div, button } = dom;

type ToolbarProps = {
  onAddShape: (type: ShapeType) => void;
  onClearAll: () => void;
};

export const Toolbar = (props: ToolbarProps) => {
  const { onAddShape, onClearAll } = props;

  return div.props({ className: 'controls' })(
    button.props({ onclick: () => onAddShape('circle') })('Add Circle'),
    button.props({
      className: 'secondary',
      onclick: () => onAddShape('rect'),
    })('Add Rectangle'),
    button.props({
      className: 'secondary',
      onclick: () => onClearAll(),
    })('Clear All')
  );
};
