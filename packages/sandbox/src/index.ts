/**
 * @rimitive/sandbox - Live code playground for Rimitive examples
 *
 * ## Quick Start
 * ```typescript
 * import { createSandbox } from '@rimitive/sandbox';
 *
 * const sandbox = createSandbox({
 *   files: [
 *     { name: 'app.ts', code: `const { signal, el } = svc; ...` },
 *   ],
 * });
 *
 * document.getElementById('sandbox-container')?.appendChild(sandbox.element);
 * ```
 *
 * ## Features
 * - Monaco editor with full TypeScript language support (types, autocomplete, errors)
 * - Multi-file support with file tabs
 * - esbuild-powered TypeScript transpilation
 * - Live code execution with error display
 * - Framework-agnostic (works in Astro, React, Vue, or vanilla JS)
 */

// Main API
export { createSandbox } from './Sandbox';

// Service (for advanced usage / custom sandbox layouts)
export { createSandboxService, type SandboxService } from './service';

// Types
export type {
  SandboxOptions,
  SandboxInstance,
  PackageSelection,
  ExecutionContext,
  ExecutionResult,
  MultiEditorState,
  ActiveTab,
  FileEntry,
} from './types';

// Core utilities (for advanced usage)
export {
  createExecutionContext,
  getDefaultSelection,
  packageInfo,
} from './lib/bundler';
export { executeUserCode } from './lib/executor';
export { executeModules } from './lib/module-executor';

// Styles (for custom sandbox layouts)
export { sandboxStyles, createStyleElement, cssVars, MONOSPACE_FONT } from './styles';

// UI components (for custom sandbox layouts)
export { MultiEditor, type MultiEditorProps, type MultiEditorResult } from './ui/MultiEditor';
export { FileTabs, type FileTabsProps } from './ui/FileTabs';
export { BottomBar, type BottomBarProps, importTemplates, type ImportTemplate } from './ui/BottomBar';
export { Controls, type ControlsProps } from './ui/Controls';
export { Output, type OutputProps } from './ui/Output';
export { ErrorDisplay, type ErrorDisplayProps } from './ui/ErrorDisplay';
