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
import { useViews } from '@lattice/runtime/react';

import { userComponent, cartComponent, themeComponent } from '../slices';

// ============================================================================
// Phase 1: Everything in Redux (legacy app)
// ============================================================================
const legacyUserStore = createReduxAdapter(userComponent);
const legacyCartStore = createReduxAdapter(cartComponent);
const legacyThemeStore = createReduxAdapter(themeComponent);

export function LegacyApp() {
  const userProfile = useViews(
    legacyUserStore,
    (views) => views.userProfile()
  );
  const cartSummary = useViews(
    legacyCartStore,
    (views) => views.cartSummary()
  );
  const themeToggle = useViews(
    legacyThemeStore,
    (views) => views.themeToggle()
  );

  return (
    <div className="app-phase-1">
      <h2>Phase 1: All Redux</h2>
      <div {...userProfile} />
      <div {...cartSummary} />
      <button
        onClick={() => {
          // Cycle through themes
          const themes: Array<'light' | 'dark' | 'system'> = [
            'light',
            'dark',
            'system',
          ];
          const currentTheme = themeToggle.currentTheme;
          const currentIndex = themes.indexOf(currentTheme);
          const nextTheme = themes[(currentIndex + 1) % themes.length];
          themeToggle.onThemeChange(nextTheme!);
        }}
        aria-pressed={themeToggle['aria-pressed']}
        className={themeToggle.className}
      >
        Theme
      </button>
    </div>
  );
}

// ============================================================================
// Phase 2: Migrate theme to Zustand (low risk, high benefit)
// ============================================================================
const modernThemeStore = createZustandAdapter(themeComponent);

export function PhaseTwo() {
  // Still using Redux for user and cart
  const userProfile = useViews(
    legacyUserStore,
    (views) => views.userProfile()
  );
  const cartSummary = useViews(
    legacyCartStore,
    (views) => views.cartSummary()
  );

  // But theme is now in Zustand!
  const themeToggle = useViews(modernThemeStore, (views) => views.themeToggle());

  return (
    <div className="app-phase-2">
      <h2>Phase 2: Theme migrated to Zustand</h2>
      <div {...userProfile} />
      <div {...cartSummary} />
      <button
        onClick={() => {
          // Cycle through themes
          const themes: Array<'light' | 'dark' | 'system'> = [
            'light',
            'dark',
            'system',
          ];
          const currentTheme = themeToggle.currentTheme;
          const currentIndex = themes.indexOf(currentTheme);
          const nextTheme = themes[(currentIndex + 1) % themes.length];
          themeToggle.onThemeChange(nextTheme!);
        }}
        aria-pressed={themeToggle['aria-pressed']}
        className={themeToggle.className}
      >
        Theme (now Zustand!)
      </button>
      <p>✅ Theme updates are now faster</p>
      <p>✅ Less boilerplate for theme changes</p>
      <p>✅ All tests still pass</p>
    </div>
  );
}

// ============================================================================
// Phase 3: Feature flag controlled migration
// ============================================================================
// Create modern store outside component to avoid recreating it
const modernUserStore = createZustandAdapter(userComponent);

export function FeatureFlagMigration() {
  const [useNewUserStore, setUseNewUserStore] = useState(false);

  // Always call both hooks to respect React's rules
  const reduxUserProfile = useViews(
    legacyUserStore,
    (views) => views.userProfile()
  );
  const zustandUserProfile = useViews(modernUserStore, (views) => views.userProfile());

  // Select which one to use based on feature flag
  const userProfile = useNewUserStore ? zustandUserProfile : reduxUserProfile;

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
// Phase 4: Complete migration
// ============================================================================
const modernCartStore = createZustandAdapter(cartComponent);

export function CompleteMigration() {
  // All stores are now Zustand
  const userProfile = useViews(modernUserStore, (views) => views.userProfile());
  const cartSummary = useViews(modernCartStore, (views) => views.cartSummary());
  const themeToggle = useViews(modernThemeStore, (views) => views.themeToggle());

  return (
    <div className="app-phase-4">
      <h2>Phase 4: Migration Complete</h2>
      <div {...userProfile} />
      <div {...cartSummary} />
      <button
        onClick={() => {
          // Cycle through themes
          const themes: Array<'light' | 'dark' | 'system'> = [
            'light',
            'dark',
            'system',
          ];
          const currentTheme = themeToggle.currentTheme;
          const currentIndex = themes.indexOf(currentTheme);
          const nextTheme = themes[(currentIndex + 1) % themes.length];
          themeToggle.onThemeChange(nextTheme!);
        }}
        aria-pressed={themeToggle['aria-pressed']}
        className={themeToggle.className}
      >
        Theme
      </button>
      <p>✅ All stores migrated to Zustand</p>
      <p>✅ Reduced bundle size</p>
      <p>✅ Better performance</p>
      <p>✅ Less boilerplate</p>
      <p>✅ All tests still pass!</p>
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
        {phase === 4 && <CompleteMigration />}
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
