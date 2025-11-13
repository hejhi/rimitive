/**
 * SSR Server Example
 *
 * Demonstrates server-side rendering with islands hydration.
 */
import { createServer } from 'node:http';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { createSSRApi } from '@lattice/view/presets/ssr';
import {
  createSSRContext,
  runWithSSRContext,
  getIslandScripts,
  renderToString,
} from '@lattice/data';
import { Counter } from './islands/Counter';
import { TodoList } from './islands/TodoList';

// Create SSR rendering API
const signals = createSignalsApi();
const { mount, create } = createSSRApi(signals);

// Define the app component
const App = create((api) => () => {
  const { el } = api;
  return el('div', { className: 'app' })(
    el('h1')('Lattice SSR Example'),
    el('p', { className: 'subtitle' })('Static content with interactive islands'),

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
      TodoList({ initialTodos: ['Learn Lattice', 'Build an app', 'Ship it!'] })
    )()
  )();
});

// Create HTTP server
const server = createServer((req, res) => {
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
  <script type="module">
    // In production, this would be a separate bundled file
    // For dev, we inline a simple module loader
    console.log('Ready to hydrate - load client.js to activate islands');
  </script>
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
