/**
 * @fileoverview Server-Side Rendering Pattern
 *
 * This example demonstrates how to use Lattice with SSR frameworks like Next.js.
 * The memory adapter is perfect for SSR because it:
 * - Has no external dependencies
 * - Can be serialized for hydration
 * - Works in Node.js environments
 */

import { createMemoryAdapter } from '@lattice/adapter-memory';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useView } from '@lattice/adapter-zustand/react';
import type { ComponentType } from '@lattice/core';
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

type DashboardComponentType = ComponentType<typeof dashboardComponent>;

// Type for the initial state - matches the model state shape
type InitialState = DashboardComponentType['model'];

// Store singleton - created once and reused
const clientStore = createZustandAdapter(dashboardComponent);
let hasHydrated = false;

// Note: If you need to type a store variable explicitly, you can use:
// type DashboardStore = ReturnType<typeof createZustandAdapter<
//   DashboardComponentType['model'],
//   DashboardComponentType['actions'],
//   DashboardComponentType['views']
// >>;

function getOrCreateStore(initialState?: InitialState) {
  // Hydrate with server state if provided and not already hydrated
  if (initialState && typeof window !== 'undefined' && !hasHydrated) {
    hasHydrated = true;

    // Use actions to restore state
    if (initialState.activeTab && initialState.activeTab !== 'overview') {
      clientStore.actions.setActiveTab(initialState.activeTab);
    }

    // For complex state restoration, you would need to add specific
    // hydration actions to your model that can restore the full state.
    // For example:
    // - restoreUser(user) action to set user state
    // - restoreCart(items) action to set cart items
    // This is a trade-off of the action-based approach.

    console.log('Initial state from server:', initialState);
  }

  return clientStore;
}

// ============================================================================
// Alternative: Create a state view for hydration checking
// ============================================================================
// If you need to check the current state, create a view in your component:
//
// const dashboardComponentWithStateView = createComponent(() => {
//   const base = dashboardComponent();
//   return {
//     ...base,
//     views: {
//       ...base.views,
//       // Add a state view that exposes what you need
//       state: createSlice(base.model, (m) => ({
//         activeTab: m.activeTab,
//         user: m.user,
//         cartItems: m.items
//       }))
//     }
//   };
// });
//
// Then you can check: const state = store.views.state();

// ============================================================================
// Page component
// ============================================================================

// Define the props type for the page component
interface DashboardPageProps {
  initialState: InitialState;
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
  // Note: dashboardComponent doesn't have cartSummary view
  // We return the header view instead as an example
  return new Response(
    JSON.stringify({
      cart: cartStore.model.get(),
      header: cartStore.views.header,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
