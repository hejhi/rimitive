import type { RefSpec } from '@rimitive/view/types';
import type { SandboxService } from '../service';
import type { FileEntry } from '../types';

/**
 * Props for the FileTabs component
 */
export type FileTabsProps = {
  /** All files */
  files: () => FileEntry[];
  /** Currently active file name */
  activeFile: () => string;
  /** Callback when a file tab is clicked */
  onFileSelect: (name: string) => void;
};

/**
 * FileTabs component - horizontal file tabs above the editor
 */
export const FileTabs =
  ({ el, map }: SandboxService) =>
  (props: FileTabsProps): RefSpec<HTMLDivElement> => {
    const { files, activeFile, onFileSelect } = props;

    return el('div').props({
      className: 'sandbox-file-tabs',
    })(
      map(
        files,
        (file) => file.name, // key function receives raw item
        (fileSignal) => {
          // render function receives a reactive signal wrapping the item
          const isActive = () => fileSignal().name === activeFile();

          return el('button')
            .props({
              className: () =>
                isActive()
                  ? 'sandbox-file-tab sandbox-file-tab--active'
                  : 'sandbox-file-tab',
              onclick: () => onFileSelect(fileSignal().name),
            })(() => fileSignal().name);
        }
      )
    );
  };
