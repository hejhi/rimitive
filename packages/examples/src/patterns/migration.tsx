/**
 * @fileoverview Migration Pattern
 *
 * This example shows how to gradually migrate from one state management
 * solution to another without rewriting your components or losing tests.
 * The key is that your behavior specifications (slices) remain unchanged.
 */

import { useState } from 'react';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useView as useReduxView } from '@lattice/adapter-redux/react';
import { useView as useZustandView } from '@lattice/adapter-zustand/react';

import { userComponent, cartComponent, themeComponent } from '../slices';

// ============================================================================
// Phase 1: Everything in Redux (legacy app)
// ============================================================================
const legacyUserStore = createReduxAdapter(userComponent);
const legacyCartStore = createReduxAdapter(cartComponent);
const legacyThemeStore = createReduxAdapter(themeComponent);

export function LegacyApp() {
  const userProfile = useReduxView(legacyUserStore, 'userProfile');
  const cartSummary = useReduxView(legacyCartStore, 'cartSummary');
  const themeToggle = useReduxView(legacyThemeStore, 'themeToggle');

  return (
    <div className="app-phase-1">
      <h2>Phase 1: All Redux</h2>
      <div {...userProfile} />
      <div {...cartSummary} />
      <button {...themeToggle}>Theme</button>
    </div>
  );
}

// ============================================================================
// Phase 2: Migrate theme to Zustand (low risk, high benefit)
// ============================================================================
const modernThemeStore = createZustandAdapter(themeComponent);

export function PhaseTwo() {
  // Still using Redux for user and cart
  const userProfile = useReduxView(legacyUserStore, 'userProfile');
  const cartSummary = useReduxView(legacyCartStore, 'cartSummary');

  // But theme is now in Zustand!
  const themeToggle = useZustandView(modernThemeStore, 'themeToggle');

  return (
    <div className="app-phase-2">
      <h2>Phase 2: Theme migrated to Zustand</h2>
      <div {...userProfile} />
      <div {...cartSummary} />
      <button {...themeToggle}>Theme (now Zustand!)</button>
      <p>✅ Theme updates are now faster</p>
      <p>✅ Less boilerplate for theme changes</p>
      <p>✅ All tests still pass</p>
    </div>
  );
}

// ============================================================================
// Phase 3: Feature flag controlled migration
// ============================================================================
export function FeatureFlagMigration() {
  const [useNewUserStore, setUseNewUserStore] = useState(false);

  // Conditionally use different adapters based on feature flag
  const userProfile = useNewUserStore
    ? useZustandView(createZustandAdapter(userComponent), 'userProfile')
    : useReduxView(legacyUserStore, 'userProfile');

  return (
    <div className="app-phase-3">
      <h2>Phase 3: Feature Flag Migration</h2>

      <label>
        <input
          type="checkbox"
          checked={useNewUserStore}
          onChange={(e) => setUseNewUserStore(e.target.checked)}
        />
        Use new Zustand user store
      </label>

      <div {...userProfile} />

      <p>Current store: {useNewUserStore ? 'Zustand' : 'Redux'}</p>
      <p>This allows A/B testing the migration!</p>
    </div>
  );
}

// ============================================================================
// Phase 4: Adapter factory pattern for gradual rollout
// ============================================================================
interface StoreConfig {
  useZustandForUser?: boolean;
  useZustandForCart?: boolean;
  useZustandForTheme?: boolean;
}

function createStores(config: StoreConfig = {}) {
  return {
    user: config.useZustandForUser
      ? createZustandAdapter(userComponent)
      : createReduxAdapter(userComponent),
    cart: config.useZustandForCart
      ? createZustandAdapter(cartComponent)
      : createReduxAdapter(cartComponent),
    theme: config.useZustandForTheme
      ? createZustandAdapter(themeComponent)
      : createReduxAdapter(themeComponent),
  };
}

// Could be controlled by environment variables, user preferences, etc.
const stores = createStores({
  useZustandForUser: false, // Still testing
  useZustandForCart: false, // Not ready yet
  useZustandForTheme: true, // Fully migrated!
});

// ============================================================================
// Shared component that works with any adapter
// ============================================================================
interface ProfileProps {
  store:
    | ReturnType<typeof createReduxAdapter>
    | ReturnType<typeof createZustandAdapter>;
  adapterType: 'redux' | 'zustand';
}

export function UniversalProfile({ store, adapterType }: ProfileProps) {
  // The component doesn't care which adapter is used!
  const profile =
    adapterType === 'redux'
      ? useReduxView(store, (views) => views.userProfile)
      : useZustandView(store, (views) => views.userProfile);

  return (
    <div className="universal-profile">
      <div {...profile} />
      <small>Powered by {adapterType}</small>
    </div>
  );
}

// ============================================================================
// Migration dashboard showing all phases
// ============================================================================
export function MigrationDashboard() {
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);

  return (
    <div className="migration-dashboard">
      <h1>Migration Strategy Example</h1>

      <div className="phase-selector">
        <button onClick={() => setPhase(1)} disabled={phase === 1}>
          Phase 1
        </button>
        <button onClick={() => setPhase(2)} disabled={phase === 2}>
          Phase 2
        </button>
        <button onClick={() => setPhase(3)} disabled={phase === 3}>
          Phase 3
        </button>
        <button onClick={() => setPhase(4)} disabled={phase === 4}>
          Phase 4
        </button>
      </div>

      <div className="phase-content">
        {phase === 1 && <LegacyApp />}
        {phase === 2 && <PhaseTwo />}
        {phase === 3 && <FeatureFlagMigration />}
        {phase === 4 && (
          <div>
            <h2>Phase 4: Flexible Architecture</h2>
            <UniversalProfile
              store={stores.user}
              adapterType={stores.user.actions ? 'zustand' : 'redux'}
            />
            <p>Components work with any adapter!</p>
          </div>
        )}
      </div>

      <div className="migration-benefits">
        <h3>Benefits of this approach:</h3>
        <ul>
          <li>No big bang rewrites</li>
          <li>Gradual, controlled migration</li>
          <li>A/B test different solutions</li>
          <li>Roll back if issues arise</li>
          <li>All tests continue to pass</li>
          <li>No changes to business logic</li>
        </ul>
      </div>
    </div>
  );
}
