# Lattice Router Example

A complete example demonstrating the `@lattice/router` package capabilities.

## What This Example Demonstrates

### 1. Multiple Routes at Root Level
- Home page at `/`
- About page at `/about`
- Products page at `/products`
- 404 Not Found page for unmatched routes

### 2. Nested Routes with Layouts
- `AppLayout` component uses `outlet()` to render child routes
- Navigation bar persists across all routes
- Demonstrates layout composition pattern

### 3. Route Parameters
- Product detail page at `/products/:id`
- Uses `params()` reactive signal to access the `:id` parameter
- Dynamic product data based on route parameter

### 4. Link Component
- Navigation bar uses `Link` components
- Active route highlighting
- SPA navigation without page reload

### 5. Programmatic Navigation
- "Go to Products" button on home page
- "Back" buttons using `navigate()` function
- Browser history management

### 6. Not Found Route
- Wildcard route `*` catches unmatched paths
- Custom 404 page with navigation back to home

## Running the Example

```bash
# Install dependencies (from repo root)
pnpm install

# Run the example
pnpm --filter @lattice/example-router dev

# Type check
pnpm --filter @lattice/example-router typecheck

# Build for production
pnpm --filter @lattice/example-router build
```

## Project Structure

```
router/
├── src/
│   ├── api.ts              # App-level API setup
│   ├── main.ts             # Entry point with route definitions
│   ├── pages/
│   │   ├── Home.ts         # Home page component
│   │   ├── About.ts        # About page component
│   │   ├── Products.ts     # Products list with links
│   │   ├── Product.ts      # Product detail with :id param
│   │   └── NotFound.ts     # 404 page
│   └── layouts/
│       └── AppLayout.ts    # Layout with nav and outlet()
├── index.html              # HTML with styling
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Key Concepts

### Route Definition
Routes are defined using the `route()` function:

```ts
api.route('/', AppLayout)(
  api.route('', Home)(),           // Root path
  api.route('about', About)(),     // /about
  api.route('products', Products)( // /products
    api.route(':id', Product)()    // /products/:id
  )
)
```

### Layout with Outlet
Layouts use `outlet()` to render matched child routes:

```ts
export const AppLayout = create(({ el, outlet }) => () => {
  return el('div')(
    el('nav')('...navigation...'),
    el('main')(
      outlet()  // Child routes render here
    )
  )();
});
```

### Route Parameters
Access dynamic route segments via `params`:

```ts
export const Product = create(({ params }) => () => {
  const productId = () => params().id;
  // Use productId reactively
});
```

### Navigation
Two ways to navigate:

1. **Link component** (declarative):
```ts
api.Link({ href: '/products' })('Products')
```

2. **navigate function** (programmatic):
```ts
el('button', { onClick: () => navigate('/') })('Home')
```

## API Setup Pattern

The `api.ts` file follows the same pattern as the view example:
- Creates signals API
- Creates DOM renderer
- Adds route and Link to the view helpers
- Exports unified API, mount, and create functions

This ensures all components have access to the same routing capabilities.
