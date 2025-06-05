/**
 * @fileoverview Lattice Examples Package
 *
 * This package demonstrates various usage patterns for Lattice, showing how
 * to build applications with reusable behavior specifications that work
 * with any state management library or UI framework.
 */

// Export all slices for reuse
export * from './slices';

// Export example patterns (note: these are .tsx files for demonstration)
// In a real app, you'd import these components individually
export { MixedStoresApp } from './patterns/mixed-stores';
export { MigrationDashboard } from './patterns/migration';
export { APIBasicsExample } from './patterns/api-basics';
export { DebuggingExample } from './patterns/api-logging';
export { MiddlewareCompositionExample } from './patterns/middleware-composition';
export { AdapterAPIExample } from './patterns/adapter-api-zustand';

// Example of how you might structure a real app
export const ExampleStructure = `
// app/
//   slices/           # All behavior specifications
//     user.ts         # User-related behaviors
//     cart.ts         # Shopping cart behaviors
//     theme.ts        # Theme/UI behaviors
//     index.ts        # Export all slices
//
//   stores/           # Adapter instances
//     user.ts         # createZustandAdapter(userSlice)
//     cart.ts         # createReduxAdapter(cartSlice)
//     theme.ts        # createZustandAdapter(themeSlice)
//
//   components/       # UI components
//     UserProfile.tsx # Uses user store
//     Cart.tsx        # Uses cart store
//     ThemeToggle.tsx # Uses theme store
//
//   pages/            # Next.js pages
//     index.tsx       # Composes components
//     _app.tsx        # Provides stores
`;

// Example of a slice module that could be published to npm
export const ReusableSliceExample = `
// @acme/user-slices
export const createUserSlice = (config?: UserConfig) => 
  createComponent(() => {
    // ... behavior specification
  });

// Then in any app:
import { createUserSlice } from '@acme/user-slices';
import { createZustandAdapter } from '@lattice/adapter-zustand';

const userStore = createZustandAdapter(createUserSlice({
  features: ['profile', 'settings', 'notifications']
}));
`;
