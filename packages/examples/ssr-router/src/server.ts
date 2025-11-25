/**
 * SSR Server with Router Support
 *
 * Uses the new createSSRHandler API for clean server-side rendering.
 * Composes services manually using signals/view/islands primitives.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSSRHandler } from '@lattice/islands/server';
import { createSignalsApi } from '@lattice/signals/presets/core';
import { defaultExtensions as defaultViewExtensions } from '@lattice/view/presets/core';
import { createSpec } from '@lattice/view/helpers';
import { composeFrom } from '@lattice/lattice';
import {
  createDOMServerRenderer,
  type DOMServerRendererConfig,
} from '@lattice/islands/presets/island-ssr';
import { createApp } from './routes.js';

/**
 * Create SSR service - called per-request for fresh signals
 */
function createSSRService() {
  const signals = createSignalsApi();
  const renderer = createDOMServerRenderer();
  const viewHelpers = createSpec(renderer, signals);
  const baseExtensions = defaultViewExtensions<DOMServerRendererConfig>();
  const views = composeFrom(baseExtensions, viewHelpers);

  const svc = {
    ...signals,
    ...views,
  };

  return { svc };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = __dirname.endsWith('src');

const clientBundlePath = isDev
  ? join(__dirname, '../dist/client/client.js')
  : join(__dirname, '../client/client.js');

// Create SSR handler for rendering pages
const ssrHandler = createSSRHandler({
  createService: createSSRService,
  createApp,
  template: (content, scripts) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lattice SSR + Router Example</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f5f5f5;
      line-height: 1.6;
    }
    .app {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .navbar {
      background: white;
      padding: 1rem 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .nav-brand h1 {
      font-size: 1.5rem;
      color: #333;
    }
    .nav-links {
      display: flex;
      gap: 1rem;
    }
    .nav-link {
      padding: 0.5rem 1rem;
      color: #666;
      text-decoration: none;
      border-radius: 4px;
      transition: all 0.2s;
    }
    .nav-link:hover {
      background: #f0f0f0;
      color: #333;
    }
    .nav-link.active {
      background: #007bff;
      color: white;
    }
    .main-content {
      flex: 1;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      padding: 2rem;
    }
    .page {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .page h2 {
      color: #333;
      margin-bottom: 1rem;
    }
    .lead {
      font-size: 1.2rem;
      color: #666;
      margin-bottom: 2rem;
    }
    section {
      margin: 2rem 0;
    }
    .card {
      background: #fafafa;
      padding: 1.5rem;
      border-radius: 4px;
      margin: 1rem 0;
    }
    .card h3 {
      color: #333;
      margin-bottom: 0.5rem;
    }
    ul, ol {
      margin-left: 1.5rem;
      margin-top: 0.5rem;
    }
    li {
      margin: 0.25rem 0;
      color: #666;
    }
    button, .primary-btn {
      background: #007bff;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.2s;
    }
    button:hover, .primary-btn:hover {
      background: #0056b3;
    }
    .product-filter-island {
      background: white;
      padding: 1.5rem;
      border-radius: 4px;
      border: 2px solid #e0e0e0;
    }
    .filter-controls {
      margin-bottom: 1.5rem;
    }
    .filter-controls label {
      margin-right: 0.5rem;
      font-weight: 600;
    }
    .filter-controls select {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    .product-card {
      background: #fafafa;
      padding: 1rem;
      border-radius: 4px;
      border: 1px solid #e0e0e0;
    }
    .product-card h4 {
      color: #333;
      margin-bottom: 0.5rem;
    }
    .category {
      color: #666;
      font-size: 0.9rem;
      text-transform: capitalize;
    }
    .price {
      color: #007bff;
      font-weight: 600;
      margin-top: 0.5rem;
    }
    .count {
      color: #666;
      font-style: italic;
      margin-top: 1rem;
    }
    .cta {
      text-align: center;
      margin: 2rem 0;
    }
  </style>
  <script>
    // Queue islands for hydration
    window.__islands = [];
    window.__hydrate = (i, t, p) => __islands.push({ i, t, p });
  </script>
</head>
<body>
  ${content}
  ${scripts}
  <script type="module" src="/client.js"></script>
</body>
</html>
  `,
});

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

  // Use SSR handler for all other routes
  ssrHandler(req, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('Try these URLs:');
  console.log(`  http://localhost:${PORT}/       - Home page (static)`);
  console.log(`  http://localhost:${PORT}/about  - About page (static)`);
  console.log(
    `  http://localhost:${PORT}/products - Products page (with island)`
  );
  console.log('Press Ctrl+C to stop');
});
