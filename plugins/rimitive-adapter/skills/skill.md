---
name: rimitive-adapter
description: Create custom adapters for Rimitive view primitives. Use when building renderers for Canvas, WebGL, terminal, native platforms, or any tree-based target.
---

# Creating Rimitive Adapters

An **adapter** abstracts tree operations for any node-based rendering target. It decouples view primitives (`el()`, `map()`, `match()`) from specific platforms, allowing the same view code to work with DOM, server rendering, Canvas, WebGL, terminals, or custom renderers.

Adapters are minimal by design—just 5 core tree operations plus optional lifecycle hooks.

---

## The Adapter Interface

```typescript
import type { Adapter, AdapterConfig } from '@rimitive/view/adapter';

type Adapter<TConfig extends AdapterConfig> = {
  // Core tree operations (required)
  createNode: (
    type: string,
    props?: Record<string, unknown>,
    parentContext?: ParentContext
  ) => TConfig['baseElement'];
  setAttribute: (
    node: TConfig['baseElement'],
    key: string,
    value: unknown
  ) => void;
  appendChild: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement']
  ) => void;
  removeChild: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement']
  ) => void;
  insertBefore: (
    parent: TConfig['baseElement'],
    child: TConfig['baseElement'],
    reference: TConfig['baseElement'] | null
  ) => void;

  // Lifecycle hooks (optional)
  beforeCreate?: (type: string, props?: Record<string, unknown>) => void;
  onCreate?: (ref: NodeRef, parent: TConfig['baseElement']) => void;
  beforeAttach?: (
    ref: NodeRef,
    parent: TConfig['baseElement'],
    nextSibling: TConfig['baseElement'] | null
  ) => void;
  onAttach?: (ref: NodeRef, parent: TConfig['baseElement']) => void;
  beforeDestroy?: (ref: NodeRef, parent: TConfig['baseElement']) => void;
  onDestroy?: (ref: NodeRef, parent: TConfig['baseElement']) => void;
};
```

---

## AdapterConfig Type

Define types for your adapter to get autocomplete in `el()`:

```typescript
type AdapterConfig = {
  props: object; // Maps tag names to prop types
  elements: object; // Maps tag names to node types
  events: object; // Maps event names to event types
  baseElement: object; // Base node type for this adapter
};
```

---

## Minimal Adapter Example

A simple in-memory adapter for testing or non-DOM environments:

```typescript
import type { Adapter, AdapterConfig } from '@rimitive/view/adapter';

type SimpleNode = {
  type: string;
  props: Record<string, unknown>;
  children: SimpleNode[];
};

type SimpleAdapterConfig = AdapterConfig & {
  props: Record<string, Record<string, unknown>>;
  elements: Record<string, SimpleNode>;
  events: Record<string, Event>;
  baseElement: SimpleNode;
};

function createSimpleAdapter(): Adapter<SimpleAdapterConfig> {
  return {
    createNode: (type, props) => ({
      type,
      props: { ...props },
      children: [],
    }),

    setAttribute: (node, key, value) => {
      node.props[key] = value;
    },

    appendChild: (parent, child) => {
      parent.children.push(child);
    },

    removeChild: (parent, child) => {
      const idx = parent.children.indexOf(child);
      if (idx !== -1) parent.children.splice(idx, 1);
    },

    insertBefore: (parent, child, reference) => {
      if (reference === null) {
        parent.children.push(child);
      } else {
        const idx = parent.children.indexOf(reference);
        if (idx !== -1) {
          parent.children.splice(idx, 0, child);
        } else {
          parent.children.push(child);
        }
      }
    },
  };
}
```

---

## Canvas Adapter Example

A more complex adapter for 2D canvas rendering:

```typescript
import type { Adapter, AdapterConfig } from '@rimitive/view/adapter';

type CanvasNode = {
  type: 'rect' | 'circle' | 'text' | 'group';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  value?: string;
  children: CanvasNode[];
  parent: CanvasNode | null;
};

type CanvasAdapterConfig = AdapterConfig & {
  props: {
    rect: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      fill?: string;
    };
    circle: { x?: number; y?: number; radius?: number; fill?: string };
    text: { x?: number; y?: number; value?: string; fill?: string };
    group: { x?: number; y?: number };
  };
  elements: {
    rect: CanvasNode;
    circle: CanvasNode;
    text: CanvasNode;
    group: CanvasNode;
  };
  events: Record<string, never>;
  baseElement: CanvasNode;
};

function createCanvasAdapter(
  ctx: CanvasRenderingContext2D
): Adapter<CanvasAdapterConfig> {
  let needsRedraw = false;
  let root: CanvasNode | null = null;

  function scheduleRedraw() {
    if (needsRedraw) return;
    needsRedraw = true;
    requestAnimationFrame(() => {
      needsRedraw = false;
      if (root) render(root);
    });
  }

  function render(node: CanvasNode, offsetX = 0, offsetY = 0) {
    const x = (node.x ?? 0) + offsetX;
    const y = (node.y ?? 0) + offsetY;

    switch (node.type) {
      case 'rect':
        if (node.fill) {
          ctx.fillStyle = node.fill;
          ctx.fillRect(x, y, node.width ?? 0, node.height ?? 0);
        }
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(x, y, node.radius ?? 0, 0, Math.PI * 2);
        if (node.fill) {
          ctx.fillStyle = node.fill;
          ctx.fill();
        }
        break;
      case 'text':
        if (node.fill) ctx.fillStyle = node.fill;
        ctx.fillText(node.value ?? '', x, y);
        break;
    }

    for (const child of node.children) {
      render(child, x, y);
    }
  }

  return {
    createNode: (type, props) => {
      const node: CanvasNode = {
        type: type as CanvasNode['type'],
        x: 0,
        y: 0,
        children: [],
        parent: null,
        ...props,
      };
      return node;
    },

    setAttribute: (node, key, value) => {
      (node as Record<string, unknown>)[key] = value;
      scheduleRedraw();
    },

    appendChild: (parent, child) => {
      child.parent = parent;
      parent.children.push(child);
      if (!root) root = parent;
      scheduleRedraw();
    },

    removeChild: (parent, child) => {
      const idx = parent.children.indexOf(child);
      if (idx !== -1) {
        parent.children.splice(idx, 1);
        child.parent = null;
      }
      scheduleRedraw();
    },

    insertBefore: (parent, child, reference) => {
      child.parent = parent;
      if (reference === null) {
        parent.children.push(child);
      } else {
        const idx = parent.children.indexOf(reference);
        parent.children.splice(
          idx !== -1 ? idx : parent.children.length,
          0,
          child
        );
      }
      if (!root) root = parent;
      scheduleRedraw();
    },
  };
}
```

---

## Using Adapters with View Modules

Pass your adapter to view module factories:

```typescript
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
} from '@rimitive/signals/extend';
import { createElModule } from '@rimitive/view/el';
import { createMapModule } from '@rimitive/view/map';
import { createMatchModule } from '@rimitive/view/match';
import { MountModule } from '@rimitive/view/deps/mount';

// Create your adapter
const adapter = createCanvasAdapter(ctx);

// Compose with view modules
const svc = compose(
  SignalModule,
  ComputedModule,
  EffectModule,
  createElModule(adapter),
  createMapModule(adapter),
  createMatchModule(adapter),
  MountModule
);

const { el, map, mount } = svc;

// Now el() creates canvas nodes instead of DOM nodes
const scene = el('group')(
  el('rect').props({ x: 10, y: 10, width: 100, height: 50, fill: 'blue' }),
  el('circle').props({ x: 200, y: 50, radius: 25, fill: 'red' })
);
```

---

## Lifecycle Hooks

Use lifecycle hooks for advanced use cases:

| Hook            | When                    | Use Cases                          |
| --------------- | ----------------------- | ---------------------------------- |
| `beforeCreate`  | Before node creation    | Hydration position setup           |
| `onCreate`      | After node ref created  | SSR markers, position sync         |
| `beforeAttach`  | Before content attached | Hydration positioning              |
| `onAttach`      | After content attached  | SSR fragments, lifecycle callbacks |
| `beforeDestroy` | Before removal          | Exit animations                    |
| `onDestroy`     | After removal           | Final cleanup                      |

### Animation Example

```typescript
const animatedAdapter: Adapter<DOMAdapterConfig> = {
  ...createDOMAdapter(),

  beforeDestroy: (ref, parent) => {
    if (ref.element instanceof HTMLElement) {
      ref.element.classList.add('exiting');
      // Note: actual animation delay requires more infrastructure
    }
  },

  onDestroy: (ref, parent) => {
    console.log('Node removed:', ref.element);
  },
};
```

---

## Cross-Renderer Composition

The `parentContext` parameter in `createNode` enables nested renderers:

```typescript
createNode: (type, props, parentContext) => {
  // parentContext.element is the parent node
  // parentContext.adapter is the parent's adapter (if different)

  // A canvas adapter nested in DOM could create a <canvas> element
  // when it detects a DOM parent context
  if (parentContext?.adapter !== this && type === 'canvas-root') {
    return document.createElement('canvas');
  }

  return createCanvasNode(type, props);
};
```

---

## Built-in Adapters

Rimitive provides these adapters:

| Adapter   | Import                         | Purpose                 |
| --------- | ------------------------------ | ----------------------- |
| DOM       | `@rimitive/view/adapters/dom`  | Browser rendering       |
| Test      | `@rimitive/view/adapters/test` | Unit testing (no DOM)   |
| Server    | `@rimitive/ssr`                | Server-side rendering   |
| Hydration | `@rimitive/ssr`                | Rehydrating server HTML |

---

## Testing Custom Adapters

Use the test adapter pattern for adapter tests:

```typescript
import { describe, it, expect } from 'vitest';

describe('CanvasAdapter', () => {
  it('creates nodes with correct type', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const adapter = createCanvasAdapter(ctx);

    const rect = adapter.createNode('rect', { x: 10, y: 20 });

    expect(rect.type).toBe('rect');
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
  });

  it('builds tree structure', () => {
    const adapter = createCanvasAdapter(ctx);
    const group = adapter.createNode('group');
    const rect = adapter.createNode('rect');

    adapter.appendChild(group, rect);

    expect(group.children).toContain(rect);
    expect(rect.parent).toBe(group);
  });
});
```

---

## Hydration Adapter Pattern

The hydration adapter demonstrates a fundamentally different approach: **reusing existing DOM** instead of creating new nodes. This is essential for SSR where the HTML already exists.

Key differences from standard adapters:

1. **`createNode` walks existing DOM** instead of creating elements
2. **Position tracking** via a mutable `path[]` array
3. **Structure validation** throws `HydrationMismatch` on mismatches
4. **Fragment marker handling** skips SSR comment markers

```typescript
import type { Adapter } from '@rimitive/view/adapter';
import type { DOMAdapterConfig } from '@rimitive/view/adapters/dom';

class HydrationMismatch extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HydrationMismatch';
  }
}

function createHydrationAdapter(
  containerEl: HTMLElement
): Adapter<DOMAdapterConfig> {
  // Mutable position - path[i] is child index at depth i
  const path: number[] = [];

  function getNodeAtPath(root: Node, indices: number[]): Node {
    let node = root;
    for (const index of indices) {
      node = node.childNodes[index];
      if (!node) throw new HydrationMismatch(`No child at index ${index}`);
    }
    return node;
  }

  return {
    createNode: (type, props) => {
      // Text nodes - reuse existing
      if (type === 'text') {
        const node = getNodeAtPath(containerEl, path);
        if (node.nodeType !== 3) {
          throw new HydrationMismatch(`Expected text, got ${node.nodeName}`);
        }
        // Update text if needed
        const text = (props?.value as string) ?? '';
        if (node.textContent !== text) node.textContent = text;
        // Advance to next sibling
        path[path.length - 1]++;
        return node;
      }

      // Element nodes - validate and reuse
      const node = getNodeAtPath(containerEl, path);
      if (
        node.nodeType !== 1 ||
        (node as Element).tagName.toLowerCase() !== type
      ) {
        throw new HydrationMismatch(
          `Expected <${type}>, got <${(node as Element).tagName}>`
        );
      }
      // Enter element's children
      path.push(0);
      return node;
    },

    setAttribute: (node, key, value) => {
      // Attach event handlers and update dynamic props
      if (node.nodeType === 3 && key === 'value') {
        node.textContent = String(value);
        return;
      }
      Reflect.set(node, key, value);
    },

    appendChild: (parent, child) => {
      // Element already attached - this is the "exit" signal
      if (child.nodeType === 1 && child.parentNode === parent) {
        path.pop(); // Exit element's children
        path[path.length - 1]++; // Advance to next sibling
      }
    },

    removeChild: () => {}, // No-op during hydration

    insertBefore: (parent, child) => {
      // Same exit signal as appendChild
      if (child.nodeType === 1 && child.parentNode === parent) {
        path.pop();
        path[path.length - 1]++;
      }
    },
  };
}
```

### Mode Switching

After hydration completes, switch to a standard adapter for dynamic updates:

```typescript
function createSwitchableAdapter(
  hydrateAdapter: Adapter<DOMAdapterConfig>,
  fallbackAdapter: Adapter<DOMAdapterConfig>
): Adapter<DOMAdapterConfig> & { switchToFallback: () => void } {
  let current = hydrateAdapter;

  return {
    createNode: (type, props) => current.createNode(type, props),
    setAttribute: (node, key, value) => current.setAttribute(node, key, value),
    appendChild: (parent, child) => current.appendChild(parent, child),
    removeChild: (parent, child) => current.removeChild(parent, child),
    insertBefore: (parent, child, ref) =>
      current.insertBefore(parent, child, ref),

    switchToFallback: () => {
      current = fallbackAdapter;
    },
  };
}

// Usage
const adapter = createSwitchableAdapter(
  createHydrationAdapter(container),
  createDOMAdapter()
);

// After hydration
adapter.switchToFallback();
```

---

## When to Create a Custom Adapter

**Good candidates:**

- Canvas/WebGL rendering
- Terminal/CLI interfaces
- Native mobile (React Native-style)
- Game engines
- PDF generation
- Custom component systems
- Hydration for custom SSR solutions

**Not necessary for:**

- Standard web apps (use DOM adapter)
- Server rendering (use SSR adapter)
- Testing (use test adapter)
- Standard hydration (use `@rimitive/ssr`)
