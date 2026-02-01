# @rimitive/sandbox

Live code playground for Rimitive examples. Features Monaco editor with full TypeScript language support (hover types, error squiggles, autocomplete), multi-file editing, and esbuild-powered execution.

## Installation

```bash
pnpm add @rimitive/sandbox
```

## Usage

```typescript
import { createSandbox } from '@rimitive/sandbox';

const sandbox = createSandbox({
  files: [
    {
      name: 'app.ts',
      code: `const { signal, computed, el } = svc;

const count = signal(0);
const doubled = computed(() => count() * 2);

return el('div')(
  el('p')(() => \`Count: \${count()}\`),
  el('p')(() => \`Doubled: \${doubled()}\`),
  el('button')
    .props({ onclick: () => count(count() + 1) })
    ('Increment')
);`,
    },
  ],
  editorHeight: '300px',
});

// Mount the sandbox
document.getElementById('sandbox-container')?.appendChild(sandbox.element);

// Programmatic control
sandbox.run(); // Execute the code
sandbox.editor.setCode('new code here');

// Cleanup when done
sandbox.dispose();
```

## Multi-File Support

```typescript
const sandbox = createSandbox({
  files: [
    { name: 'app.ts', code: `import { counter } from './counter';\n...` },
    { name: 'counter.ts', code: `export const counter = ...` },
  ],
  entryFile: 'app.ts', // Optional, defaults to first file
});
```

## Features

- **Monaco editor** with TypeScript/JSX support, hover types, and error diagnostics
- **Multi-file editing** with file tabs
- **esbuild bundling** for real import/export support
- **Live execution** - run code and see rendered output
- **Error display** - clear error messages with stack traces
- **Shadow DOM isolation** - styles don't leak from host page
- **Framework agnostic** - works in Astro, React, Vue, or vanilla JS

## User Code Pattern

User code receives `svc` containing Rimitive primitives:

```typescript
// User code should destructure from svc
const { signal, computed, el, map, match } = svc;

// Create reactive state
const items = signal(['a', 'b', 'c']);

// Return a Rimitive element (RefSpec)
return el('ul')(
  map(items, (item) => item, (itemSignal) =>
    el('li')(itemSignal)
  )
);
```

## API

### `createSandbox(options)`

Creates a sandbox instance.

**Options:**
- `files: FileEntry[]` - Files to display in the editor
- `entryFile?: string` - Entry file for execution (defaults to first file)
- `editorHeight?: string` - CSS height for editor (default: '250px')

**Returns `SandboxInstance`:**
- `element: HTMLElement` - The sandbox DOM element to mount
- `editor.code(): string` - Get current file's code
- `editor.setCode(code: string)` - Set current file's code
- `editor.files(): FileEntry[]` - Get all files
- `editor.activeFile(): string` - Get active file name
- `editor.setActiveFile(name: string)` - Switch to a file
- `result(): ExecutionResult | null` - Get last execution result
- `run()` - Execute the current code
- `dispose()` - Clean up resources

## Architecture

```
src/
├── lib/
│   ├── bundler.ts        # esbuild bundling and package composition
│   ├── executor.ts       # Code execution in isolated scope
│   └── module-executor.ts # Multi-file execution
├── ui/
│   ├── MultiEditor.ts    # Monaco editor bridge component
│   ├── FileTabs.ts       # File tab navigation
│   ├── BottomBar.ts      # Code/Preview toggle
│   ├── Output.ts         # Rendered output container
│   └── ErrorDisplay.ts   # Error message component
├── styles/
│   ├── theme.ts          # CSS variables
│   └── sandbox.styles.ts # Component styles
├── Sandbox.ts            # Main sandbox composition
├── types.ts              # Public types
└── index.ts              # Package exports
```

All UI components are built with Rimitive's own view primitives.

## License

MIT
