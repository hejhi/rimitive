/**
 * SSR Server Example
 *
 * Demonstrates server-side rendering with islands hydration.
 * Composes services manually using signals/view/islands primitives.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions as defaultViewExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { composeFrom } from '@lattice/lattice';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
} from '@lattice/islands/ssr-context';
import { renderToString } from '@lattice/islands/helpers/renderToString';
import {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '@lattice/islands/presets/island-ssr';
import type { RefSpec } from '@lattice/view/types';

import { Counter } from './islands/Counter.js';
import { TodoList } from './islands/TodoList.js';
import { TagList } from './islands/TagList.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientBundlePath = join(__dirname, '../dist/client/client.js');

// Create island-aware SSR API (fresh per-request in real app, shared here for simplicity)
const signals = createSignalsApi();
const renderer = createDOMServerRenderer();
const viewHelpers = createSpec(renderer, signals);
const baseExtensions = defaultViewExtensions<DOMServerRendererConfig>();
const views = composeFrom(baseExtensions, viewHelpers);
const svc = { ...signals, ...views };
const mount = <TElement>(spec: RefSpec<TElement>) => spec.create(svc);
const { el } = svc;

// Define the app component
const App = () => {
  return el('div', { className: 'app' })(
    el('h1')('Lattice SSR Example'),
    el('p', { className: 'subtitle' })(
      'Static content with interactive islands'
    ),

    // Static section - no JS shipped
    el('section', { className: 'static-section' })(
      el('h2')('Static Section'),
      el('p')('This content is rendered on the server and stays static.'),
      el('p')('No JavaScript needed for this part!')
    )(),

    // Interactive islands - JS shipped only for these
    el('section', { className: 'islands-section' })(
      el('h2')('Interactive Islands'),
      Counter({ initialCount: 0 }),
      TodoList({ initialTodos: ['Learn Lattice', 'Build an app', 'Ship it!'] }),
      el('div', { className: 'tag-container' })(
        el('h3')('Interactive Tags (Fragment Island)'),
        el('p')(
          'Click tags to remove them. This island returns multiple elements without a root wrapper.'
        ),
        TagList({
          tags: ['TypeScript', 'SSR', 'Islands', 'Hydration', 'Reactive'],
        })
      )()
    )()
  )();
};

// Create HTTP server
const server = createServer((req, res) => {
  // Serve client bundle
  if (req.url === '/client.js') {
    if (existsSync(clientBundlePath)) {
      const bundle = readFileSync(clientBundlePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(bundle);
    } else {
      res.writeHead(404);
      res.end('Client bundle not found. Run: pnpm build:client');
    }
    return;
  }

  if (req.url === '/') {
    // Create SSR context for this request
    const ctx = createSSRContext();

    // Render app to HTML within SSR context
    const html = runWithSSRContext(ctx, () => {
      const rendered = mount(App());
      return renderToString(rendered);
    });

    // Get island hydration scripts
    const scripts = getIslandScripts(ctx);

    // Send complete HTML page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lattice SSR Example</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    .app {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      margin-top: 0;
    }
    .subtitle {
      color: #666;
      font-size: 1.1rem;
    }
    section {
      margin: 2rem 0;
      padding: 1.5rem;
      background: #fafafa;
      border-radius: 4px;
    }
    .counter, .todo-list {
      background: #fff;
      padding: 1.5rem;
      border-radius: 4px;
      margin: 1rem 0;
      border: 2px solid #e0e0e0;
    }
    button {
      background: #007bff;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      margin: 0.25rem;
    }
    button:hover {
      background: #0056b3;
    }
    .counter-value {
      margin: 0 1rem;
      display: inline-block;
    }
    input {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-right: 0.5rem;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      padding: 0.5rem;
      margin: 0.25rem 0;
      background: #f9f9f9;
      border-radius: 4px;
    }
    .tag-container {
      background: #fff;
      padding: 1.5rem;
      border-radius: 4px;
      margin: 1rem 0;
      border: 2px solid #e0e0e0;
    }
    .tag {
      display: inline-block;
      background: #007bff;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      margin: 0.25rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .tag:hover {
      background: #0056b3;
    }
  </style>
  <script>
    // Queue islands for hydration
    window.__islands = [];
    window.__hydrate = (i, t, p) => __islands.push({ i, t, p });
  </script>
</head>
<body>
  ${html}
  ${scripts}
  <script type="module" src="/client.js"></script>
</body>
</html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('Press Ctrl+C to stop');
});
