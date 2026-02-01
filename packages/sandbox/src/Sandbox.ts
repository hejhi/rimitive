import type { RefSpec } from '@rimitive/view/types';
import type {
  SandboxOptions,
  SandboxInstance,
  ExecutionResult,
} from './types';
import { createSandboxService } from './service';
import { executeModules } from './lib/module-executor';
import { initTranspiler } from './lib/transpiler';
import { sandboxStyles } from './styles';
import { MultiEditor, type MultiEditorState } from './ui/MultiEditor';
import { FileTabs } from './ui/FileTabs';
import { BottomBar, type ActiveTab } from './ui/BottomBar';
import { Output } from './ui/Output';

/**
 * Create a sandbox instance
 *
 * @example
 * ```ts
 * import { createSandbox } from '@rimitive/sandbox';
 *
 * const sandbox = createSandbox({
 *   files: [
 *     { name: 'app.ts', code: 'const { signal, el } = svc; ...' },
 *   ],
 * });
 *
 * document.body.appendChild(sandbox.element);
 *
 * // Later: clean up
 * sandbox.dispose();
 * ```
 */
export function createSandbox(options: SandboxOptions): SandboxInstance {
  const { files, entryFile, editorHeight = '250px' } = options;

  if (files.length === 0) {
    throw new Error('At least one file is required');
  }

  const firstFile = files[0]!;
  const normalizedEntryFile = entryFile ?? firstFile.name;

  // Validate entry file exists
  if (!files.some((f) => f.name === normalizedEntryFile)) {
    throw new Error(
      `Entry file "${normalizedEntryFile}" not found in files: ${files.map((f) => f.name).join(', ')}`
    );
  }

  // Create the sandbox's own service for UI rendering
  const svc = createSandboxService();
  const { signal, computed, el, shadow, mount } = svc;

  // Preload transpiler in background (don't await - let it load while user views code)
  initTranspiler();

  // State
  const activeTab = signal<ActiveTab>('code');
  const result = signal<ExecutionResult | null>(null);

  // Editor state will be set inside the shadow ref
  let editor: MultiEditorState;

  // Run function - executes code
  const run = async () => {
    const execResult = await executeModules(editor.files(), normalizedEntryFile);
    result(execResult);
  };

  // Handle adding import to current file
  const handleAddImport = (importStatement: string) => {
    const currentCode = editor.code();
    const lines = currentCode.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i]?.trim().startsWith('import ')) {
        lastImportIndex = i;
      } else if (lines[i]?.trim() && lastImportIndex >= 0) {
        break;
      }
    }

    if (lastImportIndex >= 0) {
      lines.splice(lastImportIndex + 1, 0, importStatement);
    } else {
      lines.unshift(importStatement);
    }

    editor.setCode(lines.join('\n'));
  };

  // Handle tab change - auto-run when switching to preview
  const handleTabChange = (tab: ActiveTab) => {
    activeTab(tab);
    if (tab === 'preview') {
      requestAnimationFrame(() => run());
    }
  };

  // Computed classes for tab visibility
  const editorContainerClass = computed(() =>
    activeTab() === 'code'
      ? 'sandbox-editor-container'
      : 'sandbox-editor-container sandbox-editor-container--hidden'
  );
  const outputContainerClass = computed(() =>
    activeTab() === 'preview'
      ? 'sandbox-output-container'
      : 'sandbox-output-container sandbox-output-container--hidden'
  );

  // Build the shadow DOM host using the shadow primitive
  const sandboxHost = el('div').props({ className: 'rimitive-sandbox-host' })(
    shadow({ mode: 'open', styles: sandboxStyles })
      .ref((shadowRoot) => {
        // Create editor with shadowRoot for CodeMirror style injection
        const editorResult = MultiEditor(svc)({
          initialFiles: files,
          activeFile: normalizedEntryFile,
          height: '100%',
          root: shadowRoot,
        });

        editor = editorResult.state;

        // Build and mount the sandbox content imperatively
        // (needed because editor creation requires shadowRoot)
        const sandboxContent: RefSpec<HTMLDivElement> = el('div').props({
          className: 'sandbox',
        })(
          // Editor container
          el('div')
            .props({
              className: editorContainerClass,
              style: `height: ${editorHeight};`,
            })(
              FileTabs(svc)({
                files: () => editor.files(),
                activeFile: () => editor.activeFile(),
                onFileSelect: (name) => editor.setActiveFile(name),
              }),
              editorResult.spec
            ),

          // Output container
          el('div')
            .props({
              className: outputContainerClass,
              style: `height: ${editorHeight};`,
            })(
              Output(svc)({
                result: () => result(),
                height: '100%',
              })
            ),

          // Bottom bar
          BottomBar(svc)({
            activeTab: () => activeTab(),
            onTabChange: handleTabChange,
            onAddImport: handleAddImport,
          })
        );

        const mountedContent = mount(sandboxContent);
        shadowRoot.appendChild(mountedContent.element!);

        return () => editor.dispose();
      })
      ()
  );

  // Mount the host
  const mountedHost = mount(sandboxHost);

  return {
    element: mountedHost.element!,
    get editor() {
      return editor;
    },
    activeTab: () => activeTab(),
    setActiveTab: handleTabChange,
    result: () => result(),
    run,
    addImport: handleAddImport,
    dispose: () => {
      editor.dispose();
    },
  };
}
