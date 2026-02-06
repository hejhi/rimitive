import type { RefSpec } from '@rimitive/view/types';
import type { SandboxService } from '../service';

/**
 * Active tab type
 */
export type ActiveTab = 'code' | 'preview';

/**
 * Import template for a package
 */
export type ImportTemplate = {
  /** Package identifier */
  id: string;
  /** Display label */
  label: string;
  /** Import statement to insert */
  importStatement: string;
};

/**
 * Available import templates
 */
export const importTemplates: ImportTemplate[] = [
  {
    id: 'signals',
    label: '+ signals',
    importStatement: `import { SignalModule, ComputedModule, EffectModule } from '@rimitive/signals/extend';`,
  },
  {
    id: 'view',
    label: '+ view',
    importStatement: `import { ElModule } from '@rimitive/view/el';
import { createDOMAdapter } from '@rimitive/view/adapters/dom';`,
  },
  {
    id: 'core',
    label: '+ core',
    importStatement: `import { compose } from '@rimitive/core';`,
  },
];

/**
 * Props for the BottomBar component
 */
export type BottomBarProps = {
  /** Current active tab */
  activeTab: () => ActiveTab;
  /** Callback when tab changes */
  onTabChange: (tab: ActiveTab) => void;
  /** Callback when an import button is clicked */
  onAddImport: (importStatement: string) => void;
};

/**
 * BottomBar component with Code/Preview toggle and import buttons
 */
export const BottomBar =
  ({ el, match }: SandboxService) =>
  (props: BottomBarProps): RefSpec<HTMLDivElement> => {
    const { activeTab, onTabChange, onAddImport } = props;

    const ToggleButton = (tab: ActiveTab, label: string) =>
      el('button').props({
        className: () =>
          activeTab() === tab
            ? 'sandbox-toggle-btn sandbox-toggle-btn--active'
            : 'sandbox-toggle-btn',
        onclick: () => onTabChange(tab),
      })(label);

    const ImportButton = (template: ImportTemplate) =>
      el('button').props({
        className: 'sandbox-import-btn',
        title: template.importStatement,
        onclick: () => onAddImport(template.importStatement),
      })(template.label);

    return el('div').props({
      className: 'sandbox-bottombar',
    })(
      // Left: Code/Preview toggle
      el('div').props({
        className: 'sandbox-toggle',
      })(ToggleButton('code', 'Code'), ToggleButton('preview', 'Preview')),

      // Right: Import buttons (only visible in code mode)
      match(activeTab, (tab) =>
        tab === 'code'
          ? el('div').props({
              className: 'sandbox-imports',
            })(
              ...importTemplates.map((template) => ImportButton(template))
            )
          : null
      )
    );
  };
