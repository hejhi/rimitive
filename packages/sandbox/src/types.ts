import type { MultiEditorState } from './ui/MultiEditor';
import type { ActiveTab } from './ui/BottomBar';

export type { MultiEditorState } from './ui/MultiEditor';
export type { ActiveTab } from './ui/BottomBar';

/**
 * A file in the sandbox
 */
export type FileEntry = {
  name: string;
  code: string;
};

/**
 * Package selection for the sandbox
 */
export type PackageSelection = {
  signals: boolean;
  view: boolean;
  router: boolean;
  resource: boolean;
};

/**
 * The execution context provided to user code
 * Contains all Rimitive primitives based on package selection
 *
 * The context is loosely typed since it's dynamically composed
 * based on the selected packages.
 */
export type ExecutionContext = {
  // Always available from signals
  signal: <T>(initial: T) => (value?: T) => T;
  computed: <T>(fn: () => T) => () => T;
  effect: (fn: () => void | (() => void)) => () => void;
  batch: (fn: () => void) => void;

  // Available when view is selected (loosely typed)
  el?: unknown;
  map?: unknown;
  match?: unknown;
  portal?: unknown;

  // Available when router is selected
  router?: unknown;
  Link?: unknown;

  // Available when resource is selected
  resource?: unknown;
};

/**
 * Result of executing user code
 */
export type ExecutionResult =
  | { success: true; element: HTMLElement | null; dispose: () => void }
  | { success: false; error: Error };

/**
 * Options for creating a sandbox
 */
export type SandboxOptions = {
  /** Files to display in the editor */
  files: FileEntry[];
  /** Entry file for execution (defaults to first file) */
  entryFile?: string;
  /** Height of the editor area */
  editorHeight?: string;
};

/**
 * Sandbox instance returned from createSandbox
 */
export type SandboxInstance = {
  /** The sandbox DOM element */
  element: HTMLElement;
  /** Editor state */
  editor: MultiEditorState;
  /** Current active tab */
  activeTab: () => ActiveTab;
  /** Set active tab (auto-runs when switching to preview) */
  setActiveTab: (tab: ActiveTab) => void;
  /** Current execution result */
  result: () => ExecutionResult | null;
  /** Manually run the code */
  run: () => void;
  /** Add an import statement to the current file */
  addImport: (importStatement: string) => void;
  /** Dispose the sandbox and clean up */
  dispose: () => void;
};
