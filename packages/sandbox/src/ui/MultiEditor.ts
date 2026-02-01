import type { RefSpec } from '@rimitive/view/types';
import type { SandboxService } from '../service';
import type { FileEntry } from '../types';
import { MonacoIframeBridge } from './monaco-bridge';
import { createMonacoIframeBlobUrl } from './monaco-iframe-html';

/**
 * Multi-file editor state
 */
export type MultiEditorState = {
  /** All files in the sandbox */
  files: () => FileEntry[];
  /** Currently active file name */
  activeFile: () => string;
  /** Set the active file */
  setActiveFile: (name: string) => void;
  /** Update a file's code */
  setFileCode: (name: string, code: string) => void;
  /** Current code (from active file) - compatible with single-file EditorState */
  code: () => string;
  /** Set current code (updates active file) - compatible with single-file EditorState */
  setCode: (code: string) => void;
  /** Dispose the editor */
  dispose: () => void;
};

/**
 * Props for the MultiEditor component
 */
export type MultiEditorProps = {
  /** Initial files */
  initialFiles: FileEntry[];
  /** Initially active file */
  activeFile?: string;
  /** Height of the editor. Use '100%' for flex container */
  height?: string;
  /** Whether to use dark theme (default: true) */
  dark?: boolean;
  /** Root for style injection (ShadowRoot or Document) - unused with Monaco iframe */
  root?: ShadowRoot | Document;
};

/**
 * MultiEditor result containing both the spec and state
 */
export type MultiEditorResult = {
  /** The editor RefSpec for rendering */
  spec: RefSpec<HTMLDivElement>;
  /** The editor state for external control */
  state: MultiEditorState;
};

/**
 * MultiEditor component using Monaco in an iframe for shadow DOM compatibility
 * and full TypeScript language support.
 */
export const MultiEditor =
  ({ signal, el }: SandboxService) =>
  (props: MultiEditorProps): MultiEditorResult => {
    const { initialFiles, activeFile: initialActiveFile, height = '200px' } =
      props;

    if (initialFiles.length === 0) {
      throw new Error('At least one file is required');
    }

    // State
    const files = signal<FileEntry[]>([...initialFiles]);
    const firstFileName = initialFiles[0]?.name ?? 'main.ts';
    const activeFileName = signal(initialActiveFile ?? firstFileName);

    // Track bridge instance
    let bridge: MonacoIframeBridge | null = null;
    let blobUrl: string | null = null;

    // Get active file's code
    const getActiveCode = () => {
      const active = activeFileName();
      const file = files().find((f) => f.name === active);
      return file?.code ?? '';
    };

    // Build classes
    const editorClass =
      height === '100%'
        ? 'sandbox-editor sandbox-editor--flex sandbox-editor--monaco'
        : 'sandbox-editor sandbox-editor--monaco';

    const spec = el('div')
      .props({
        className: editorClass,
        style: height !== '100%' ? `height: ${height};` : undefined,
      })
      .ref((container) => {
        // Create blob URL for iframe
        blobUrl = createMonacoIframeBlobUrl();

        // Create iframe (no sandbox needed - content is fully controlled via blob URL)
        const iframe = document.createElement('iframe');
        iframe.src = blobUrl;
        iframe.style.cssText =
          'width: 100%; height: 100%; border: none; display: block;';
        container.appendChild(iframe);

        // Create bridge
        bridge = new MonacoIframeBridge(iframe);

        // Handle code changes from Monaco
        bridge.onCodeChange((fileName, newCode) => {
          const currentFiles = files();
          const index = currentFiles.findIndex((f) => f.name === fileName);
          if (index !== -1) {
            const newFiles = [...currentFiles];
            const existingFile = newFiles[index];
            if (existingFile && existingFile.code !== newCode) {
              newFiles[index] = { name: existingFile.name, code: newCode };
              files(newFiles);
            }
          }
        });

        // Send init message when ready
        bridge.onReady(() => {
          bridge?.send({
            type: 'INIT',
            files: files(),
            activeFile: activeFileName(),
          });
        });

        // Cleanup
        return () => {
          bridge?.dispose();
          bridge = null;
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            blobUrl = null;
          }
        };
      })();

    const state: MultiEditorState = {
      files: () => files(),
      activeFile: () => activeFileName(),

      setActiveFile: (name: string) => {
        const fileExists = files().some((f) => f.name === name);
        if (fileExists && name !== activeFileName()) {
          activeFileName(name);
          bridge?.send({ type: 'SWITCH_FILE', name });
        }
      },

      setFileCode: (name: string, code: string) => {
        const currentFiles = files();
        const index = currentFiles.findIndex((f) => f.name === name);
        if (index !== -1) {
          const newFiles = [...currentFiles];
          const existingFile = newFiles[index];
          if (existingFile) {
            newFiles[index] = { name: existingFile.name, code };
            files(newFiles);
            bridge?.send({ type: 'SET_FILE', name, code });
          }
        }
      },

      // EditorState-compatible API
      code: () => getActiveCode(),

      setCode: (code: string) => {
        const name = activeFileName();
        const currentFiles = files();
        const index = currentFiles.findIndex((f) => f.name === name);
        if (index !== -1) {
          const newFiles = [...currentFiles];
          const existingFile = newFiles[index];
          if (existingFile) {
            newFiles[index] = { name: existingFile.name, code };
            files(newFiles);
            bridge?.send({ type: 'SET_FILE', name, code });
          }
        }
      },

      dispose: () => {
        bridge?.dispose();
        bridge = null;
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
        }
      },
    };

    return { spec, state };
  };
