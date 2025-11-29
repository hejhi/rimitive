/**
 * SSR Server with Router Support
 *
 * Uses createIslandsApp for a clean, unified API.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIslandsApp } from '@lattice/islands/server';
import { createRouter, type ViewApi } from '@lattice/router';
import { type DOMRendererConfig } from '@lattice/view/renderers/dom';
import { appRoutes } from './routes.js';
import { buildAppContext } from './service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = __dirname.endsWith('src');

const clientBundlePath = isDev
  ? join(__dirname, '../dist/client/client.js')
  : join(__dirname, '../client/client.js');

/**
 * HTML template
 */
const template = (content: string, scripts: string) => `
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
    .product-card.clickable {
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .product-card.clickable:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .view-details {
      display: block;
      color: #007bff;
      font-size: 0.9rem;
      margin-top: 0.5rem;
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
    /* Product detail page styles */
    .product-detail-page .breadcrumb {
      color: #666;
      margin-bottom: 1rem;
    }
    .product-detail-page .breadcrumb a {
      color: #007bff;
      text-decoration: none;
    }
    .product-detail-page .breadcrumb a:hover {
      text-decoration: underline;
    }
    .product-detail {
      max-width: 600px;
    }
    .product-detail header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .product-detail h2 {
      margin: 0;
    }
    .product-detail .description {
      color: #666;
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .product-detail .price {
      font-size: 1.5rem;
      font-weight: 600;
      color: #007bff;
      margin-bottom: 1.5rem;
    }
    .secondary-btn {
      background: #f5f5f5;
      color: #333;
      border: 1px solid #ccc;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 1rem;
    }
    .secondary-btn:hover {
      background: #e5e5e5;
    }
    /* Add to Cart island styles */
    .add-to-cart-section {
      margin: 1.5rem 0;
      padding: 1rem;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .add-to-cart-island {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .quantity-selector {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .qty-btn {
      width: 32px;
      height: 32px;
      border: 1px solid #ccc;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1.2rem;
    }
    .qty-btn:hover:not(:disabled) {
      background: #f0f0f0;
    }
    .qty-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .qty-display {
      min-width: 40px;
      text-align: center;
      font-weight: 600;
    }
    .add-btn {
      flex: 1;
      padding: 0.75rem 1.5rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.2s;
    }
    .add-btn:hover:not(:disabled) {
      background: #0056b3;
    }
    .add-btn.added {
      background: #28a745;
    }
    .add-btn:disabled {
      cursor: default;
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
`;

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

  // SSR handling
  const url = new URL(
    req.url || '/',
    `http://${req.headers.host || 'localhost'}`
  );
  const path = url.pathname;

  // Create islands app for this request (fresh signals per request)
  const app = createIslandsApp({
    context: () => buildAppContext(url),
  });

  // Create router with service
  // Note: cast needed as router expects ViewApi shape, service has it structurally
  const router = createRouter<DOMRendererConfig>(
    app.service as ViewApi<DOMRendererConfig>,
    { initialPath: path }
  );

  // Render the route tree to HTML
  const { html, scripts } = app.render(router.mount(appRoutes));

  // Generate full HTML page
  const fullHtml = template(html, scripts);

  // Send response
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fullHtml);
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
