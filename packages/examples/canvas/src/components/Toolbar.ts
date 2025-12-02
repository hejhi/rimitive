/**
 * Toolbar Component (DOM)
 *
 * Uses the DOM renderer for UI controls.
 * Shares signals with the canvas scene.
 */
import { dom } from '../service';
import type { ShapeType } from '../behaviors/useShapeEditor';

const { el, addEventListener } = dom;

interface ToolbarProps {
  onAddShape: (type: ShapeType) => void;
  onClearAll: () => void;
}

export const Toolbar = (props: ToolbarProps) => {
  const { onAddShape, onClearAll } = props;

  return el('div').props({ className: 'controls' })(
    el('button')('Add Circle')(
      addEventListener('click', () => onAddShape('circle'))
    ),
    el('button').props({ className: 'secondary' })('Add Rectangle')(
      addEventListener('click', () => onAddShape('rect'))
    ),
    el('button').props({ className: 'secondary' })('Clear All')(
      addEventListener('click', () => onClearAll())
    )
  );
};
