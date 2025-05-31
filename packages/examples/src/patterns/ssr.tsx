/**
 * @fileoverview Server-Side Rendering Pattern
 *
 * This example demonstrates how to use Lattice with SSR frameworks like Next.js.
 * The memory adapter is perfect for SSR because it:
 * - Has no external dependencies
 * - Can be serialized for hydration
 * - Works in Node.js environments
 */

// Remove unused React import
import { createMemoryAdapter } from '@lattice/adapter-memory';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useView } from '@lattice/adapter-zustand/react';
import type { GetServerSideProps } from 'next';

import { dashboardComponent } from '../slices';

// ============================================================================
// Server-side: Use memory adapter
// ============================================================================
export const getServerSideProps: GetServerSideProps = async (_context) => {
  const adapter = createMemoryAdapter();
  const dashboardStore = adapter.executeComponent(dashboardComponent);

  // Simulate fetching user data
  await dashboardStore.actions.get().login('user@example.com', 'password');

  // Simulate loading cart from session
  const cartItems = [
    { id: '1', name: 'Product 1', price: 29.99 },
    { id: '2', name: 'Product 2', price: 49.99 },
  ];

  for (const item of cartItems) {
    dashboardStore.actions.get().addToCart(item);
  }

  // Get the entire state for hydration
  const initialState = dashboardStore.model.get();

  return {
    props: {
      initialState,
    },
  };
};

// ============================================================================
// Client-side: Hydrate Zustand store with SSR data
// ============================================================================
let clientStore: ReturnType<typeof createZustandAdapter> | null = null;

function getOrCreateStore(initialState?: any) {
  // Create store only once
  if (!clientStore) {
    clientStore = createZustandAdapter(dashboardComponent);

    // Hydrate with server state if provided
    if (initialState && typeof window !== 'undefined') {
      // Hydrate the state using actions
      if (initialState.activeTab) {
        clientStore.actions.setActiveTab(initialState.activeTab);
      }
      
      // Note: For complex state like user/cart, you'd need custom
      // hydration actions in your model to restore the full state
      // from the server. This is a limitation of action-based updates.
      console.log('Initial state from server:', initialState);
    }
  }

  return clientStore;
}

// ============================================================================
// Page component
// ============================================================================
interface DashboardPageProps {
  initialState?: any; // The dashboard component state type
}

export default function DashboardPage({ initialState }: DashboardPageProps) {
  const store = getOrCreateStore(initialState);
  const header = useView(store, 'header');
  const navigation = useView(store, 'navigation');

  return (
    <div className="dashboard-page">
      <header {...header} />

      <nav>
        {navigation.tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={tab.onClick}
            className={tab.active ? 'active' : ''}
          >
            {tab.name}
          </button>
        ))}
      </nav>

      <main>
        <h1>SSR Dashboard Example</h1>
        <p>
          This page was rendered on the server with initial data, then hydrated
          on the client with Zustand.
        </p>

        <section>
          <h2>Benefits of this approach:</h2>
          <ul>
            <li>SEO-friendly: Full content rendered on server</li>
            <li>Fast initial load: No client-side data fetching</li>
            <li>Progressive enhancement: Works without JavaScript</li>
            <li>Type-safe: Same types on server and client</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

// ============================================================================
// Alternative: API Route Pattern
// ============================================================================
export async function apiRouteExample(req: Request) {
  // Use memory adapter for API routes too
  const adapter = createMemoryAdapter();
  const cartStore = adapter.executeComponent(dashboardComponent);

  // Process request
  const body = await req.json();

  if (body.action === 'addItem') {
    cartStore.actions.get().addToCart(body.item);
  }

  // Return current state
  return new Response(
    JSON.stringify({
      cart: cartStore.model.get(),
      summary: cartStore.views.cartSummary.get(),
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
