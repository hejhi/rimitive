/**
 * Inline HTML template for Monaco editor iframe
 *
 * This runs in an iframe to avoid shadow DOM style conflicts.
 * Monaco is loaded from jsdelivr CDN.
 */

import { bundledTypes } from './bundled-types';

// Base64 encode the bundled types for safe embedding in HTML
// This avoids issues with template literal syntax (${, backticks) in the types
const base64Types = btoa(unescape(encodeURIComponent(bundledTypes)));

export const monacoIframeHtml = /* html */ `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #1e1e1e;
    }
    #container {
      width: 100%;
      height: 100%;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #808080;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="container"><div class="loading">Loading editor...</div></div>

  <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs/loader.js"></script>
  <script>
    // Bundled @rimitive types (base64 encoded, embedded at build time)
    const BUNDLED_TYPES = decodeURIComponent(escape(atob('${base64Types}')));

    // State
    let editor = null;
    let models = new Map(); // fileName -> model
    let currentFile = null;

    // Monaco AMD loader config
    require.config({
      paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs'
      }
    });

    // Send message to parent
    function postToParent(message) {
      window.parent.postMessage(message, '*');
    }

    // Get language from file name
    function getLanguage(fileName) {
      if (fileName.endsWith('.tsx')) return 'typescript';
      if (fileName.endsWith('.ts')) return 'typescript';
      if (fileName.endsWith('.jsx')) return 'javascript';
      if (fileName.endsWith('.js')) return 'javascript';
      if (fileName.endsWith('.json')) return 'json';
      if (fileName.endsWith('.css')) return 'css';
      if (fileName.endsWith('.html')) return 'html';
      return 'typescript';
    }

    // Create or get model for a file
    // Track extra libs for file resolution
    const extraLibs = new Map(); // fileName -> disposable

    function getOrCreateModel(fileName, code) {
      let model = models.get(fileName);
      if (!model) {
        const uri = monaco.Uri.parse('file:///' + fileName);
        model = monaco.editor.createModel(code, getLanguage(fileName), uri);

        // Add as extra lib for cross-file import resolution
        const libUri = 'file:///' + fileName;
        const disposable = monaco.languages.typescript.typescriptDefaults.addExtraLib(code, libUri);
        extraLibs.set(fileName, disposable);

        // Listen for changes and update extra lib
        model.onDidChangeContent(() => {
          const newCode = model.getValue();
          // Update extra lib with new content
          const oldDisposable = extraLibs.get(fileName);
          if (oldDisposable) oldDisposable.dispose();
          const newDisposable = monaco.languages.typescript.typescriptDefaults.addExtraLib(newCode, libUri);
          extraLibs.set(fileName, newDisposable);

          postToParent({
            type: 'CODE_CHANGE',
            fileName: fileName,
            code: newCode
          });
        });

        models.set(fileName, model);
      }
      return model;
    }

    // Handle messages from parent
    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.type) {
        case 'INIT': {
          // Create models for all files
          for (const file of message.files) {
            getOrCreateModel(file.name, file.code);
          }

          // Set initial file
          const model = models.get(message.activeFile);
          if (model && editor) {
            editor.setModel(model);
            currentFile = message.activeFile;
          }
          break;
        }

        case 'SET_FILE': {
          const model = models.get(message.name);
          if (model) {
            // Avoid triggering change event for external updates
            const currentValue = model.getValue();
            if (currentValue !== message.code) {
              model.setValue(message.code);
            }
          } else {
            getOrCreateModel(message.name, message.code);
          }
          break;
        }

        case 'SWITCH_FILE': {
          const model = models.get(message.name);
          if (model && editor) {
            editor.setModel(model);
            currentFile = message.name;
          }
          break;
        }

        case 'FOCUS': {
          if (editor) {
            editor.focus();
          }
          break;
        }
      }
    });

    // Initialize Monaco
    require(['vs/editor/editor.main'], function() {
      // TypeScript compiler options (defined here after monaco is loaded)
      const compilerOptions = {
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        lib: ['esnext', 'dom', 'dom.iterable'],
        strict: true,
        noImplicitAny: false, // Relaxed for sandbox - hover types still work
        esModuleInterop: true,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        jsxFactory: 'h',
        jsxFragmentFactory: 'Fragment',
        noEmit: true,
        isolatedModules: true,
        allowNonTsExtensions: true,
        allowImportingTsExtensions: true,
      };

      // Configure TypeScript
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });

      // Add bundled @rimitive types
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        BUNDLED_TYPES,
        'file:///node_modules/@rimitive/types.d.ts'
      );

      // Create editor
      const container = document.getElementById('container');
      container.innerHTML = '';

      editor = monaco.editor.create(container, {
        theme: 'vs-dark',
        fontSize: 13,
        fontFamily: "'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 8 },
        renderLineHighlight: 'line',
        cursorBlinking: 'smooth',
        smoothScrolling: true,
        fixedOverflowWidgets: true,
      });

      // Listen for marker changes (diagnostics)
      monaco.editor.onDidChangeMarkers((uris) => {
        for (const uri of uris) {
          const fileName = uri.path.slice(1); // Remove leading /
          const model = models.get(fileName);
          if (model) {
            const markers = monaco.editor.getModelMarkers({ resource: uri });
            const diagnostics = markers.map(m => ({
              message: m.message,
              severity: m.severity === 8 ? 'error' :
                        m.severity === 4 ? 'warning' :
                        m.severity === 2 ? 'info' : 'hint',
              startLineNumber: m.startLineNumber,
              startColumn: m.startColumn,
              endLineNumber: m.endLineNumber,
              endColumn: m.endColumn
            }));

            postToParent({
              type: 'DIAGNOSTICS',
              fileName: fileName,
              diagnostics: diagnostics
            });
          }
        }
      });

      // Notify parent we're ready
      postToParent({ type: 'READY' });
    });
  </script>
</body>
</html>
`;

/**
 * Create a blob URL for the Monaco iframe HTML
 */
export function createMonacoIframeBlobUrl(): string {
  const blob = new Blob([monacoIframeHtml], { type: 'text/html' });
  return URL.createObjectURL(blob);
}
