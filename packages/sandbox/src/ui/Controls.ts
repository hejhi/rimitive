import type { RefSpec } from '@rimitive/view/types';
import type { SandboxService } from '../service';
import type { PackageSelection } from '../types';
import { packageInfo } from '../lib/bundler';

/**
 * Props for the Controls component
 */
export type ControlsProps = {
  /** Current package selection */
  selection: () => PackageSelection;
  /** Callback when selection changes */
  onSelectionChange: (selection: PackageSelection) => void;
  /** Callback when run button is clicked */
  onRun: () => void;
};

/**
 * Controls component with package selection checkboxes and run button
 */
export const Controls =
  ({ el }: SandboxService) =>
  (props: ControlsProps): RefSpec<HTMLDivElement> => {
    const { selection, onSelectionChange, onRun } = props;

    const Checkbox = (
      pkg: keyof PackageSelection,
      info: { label: string; description: string }
    ) =>
      el('label').props({
        className: 'sandbox-controls__checkbox',
        title: info.description,
      })(
        el('input')
          .props({
            type: 'checkbox',
            checked: selection()[pkg],
          })
          .ref((input) => {
            const handleChange = () => {
              onSelectionChange({
                ...selection(),
                [pkg]: input.checked,
              });
            };
            input.addEventListener('change', handleChange);
            return () => input.removeEventListener('change', handleChange);
          })(),
        el('span')(info.label)
      );

    return el('div').props({
      className: 'sandbox-controls',
    })(
      // Package checkboxes
      el('div').props({
        className: 'sandbox-controls__packages',
      })(
        el('span').props({
          className: 'sandbox-controls__label',
        })('Packages:'),
        ...Object.entries(packageInfo).map(([pkg, info]) =>
          Checkbox(pkg as keyof PackageSelection, info)
        )
      ),

      // Spacer
      el('div').props({ className: 'sandbox-controls__spacer' })(),

      // Run button
      el('button').props({
        className: 'sandbox-run-btn',
        onclick: onRun,
      })('Run')
    );
  };
