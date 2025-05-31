/**
 * @fileoverview Mixed State Management Pattern
 *
 * This example shows how to use different state managers for different parts
 * of your application based on their specific strengths:
 * - Zustand for fast local state (user preferences, UI state)
 * - Redux for complex state with debugging needs (shopping cart, forms)
 * - Memory adapter for server-side rendering
 */

import React from 'react';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { createReduxAdapter } from '@lattice/adapter-redux';
import { useView as useZustandView } from '@lattice/adapter-zustand/react';
import { useView as useReduxView } from '@lattice/adapter-redux/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { userComponent, cartComponent, themeComponent } from '../slices';

// ============================================================================
// User state in Zustand - Fast local updates, minimal boilerplate
// ============================================================================
const userStore = createZustandAdapter(userComponent);

export function UserProfileWidget() {
  const profile = useZustandView(userStore, 'userProfile');
  const actions = userStore.actions;

  return (
    <div {...profile}>
      <button onClick={() => actions.logout()}>Logout</button>
    </div>
  );
}

// ============================================================================
// Cart state in Redux - Time-travel debugging, middleware, DevTools
// ============================================================================
const cartStore = createReduxAdapter(cartComponent);

// Create Redux store that syncs with Lattice
const reduxStore = configureStore({
  reducer: (state = cartStore.getState(), action) => {
    if (action.type === 'SYNC') {
      return cartStore.getState();
    }
    return state;
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

cartStore.subscribe(() => {
  reduxStore.dispatch({ type: 'SYNC' });
});

export function ShoppingCart() {
  const summary = useReduxView(cartStore, ({ cartSummary }) => cartSummary);
  const actions = cartStore.actions;

  return (
    <Provider store={reduxStore}>
      <div {...summary}>
        <button onClick={() => actions.clear()}>Clear Cart</button>
      </div>
    </Provider>
  );
}

// ============================================================================
// Theme in Zustand with localStorage persistence
// ============================================================================
const themeStore = createZustandAdapter(themeComponent);

// Add persistence
if (typeof window !== 'undefined') {
  // Load saved theme
  const saved = localStorage.getItem('theme-settings');
  if (saved) {
    const settings = JSON.parse(saved);
    themeStore.actions.setTheme(settings.theme);
    themeStore.actions.setFontSize(settings.fontSize);
    if (settings.reducedMotion) {
      themeStore.actions.toggleReducedMotion();
    }
  }

  // Save on changes - subscribe to the documentRoot view
  themeStore.subscribe(
    (views) => views.documentRoot(),
    (rootAttrs) => {
      // Extract theme settings from the view attributes
      const className = rootAttrs.className || '';
      const theme = className.includes('theme-dark')
        ? 'dark'
        : className.includes('theme-light')
          ? 'light'
          : 'system';
      const fontSize = className.includes('font-small')
        ? 'small'
        : className.includes('font-large')
          ? 'large'
          : 'medium';
      const reducedMotion = className.includes('reduced-motion');

      localStorage.setItem(
        'theme-settings',
        JSON.stringify({ theme, fontSize, reducedMotion })
      );
    }
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const rootAttrs = useZustandView(themeStore, 'documentRoot');

  React.useEffect(() => {
    Object.entries(rootAttrs).forEach(([key, value]) => {
      if (key === 'className') {
        document.documentElement.className = value as string;
      } else {
        document.documentElement.setAttribute(key, value as string);
      }
    });
  }, [rootAttrs]);

  return <>{children}</>;
}

// ============================================================================
// Hybrid component using multiple stores
// ============================================================================
export function HybridDashboard() {
  // Different stores for different concerns
  const userProfile = useZustandView(userStore, 'userProfile');
  const cartSummary = useReduxView(cartStore, ({ cartSummary }) => cartSummary);
  const themeToggle = useZustandView(themeStore, 'themeToggle');

  return (
    <div className="dashboard">
      <header>
        <div {...userProfile} />
        <div {...cartSummary} />
        <button 
          onClick={() => {
            // Cycle through themes
            const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
            const currentTheme = themeToggle.currentTheme;
            const currentIndex = themes.indexOf(currentTheme);
            const nextTheme = themes[(currentIndex + 1) % themes.length];
            themeToggle.onThemeChange(nextTheme!);
          }}
          aria-pressed={themeToggle['aria-pressed']}
          className={themeToggle.className}
        >
          Toggle Theme
        </button>
      </header>

      <main>
        <h1>Mixed State Management Example</h1>
        <p>
          This dashboard uses:
          <ul>
            <li>Zustand for user state (fast updates)</li>
            <li>Redux for cart state (debugging)</li>
            <li>Zustand for theme (with persistence)</li>
          </ul>
        </p>
      </main>
    </div>
  );
}

// ============================================================================
// Example app combining all patterns
// ============================================================================
export function MixedStoresApp() {
  return (
    <ThemeProvider>
      <div className="app">
        <HybridDashboard />
        <UserProfileWidget />
        <ShoppingCart />
      </div>
    </ThemeProvider>
  );
}
