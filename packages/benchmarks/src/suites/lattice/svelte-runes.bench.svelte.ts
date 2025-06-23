/**
 * @fileoverview Svelte 5 Runes Over-Reactivity Performance Benchmark
 *
 * Compares plain Svelte 5 runes $derived against Lattice slices in scenarios where
 * traditional $derived over-triggers due to unrelated state changes.
 *
 * Key insight: $derived recalculates when ANY dependency changes.
 * Lattice slices only recalculate when their specific dependencies change.
 */

import { describe, bench } from 'vitest';
import { createStore } from '@lattice/core';

// Test scenario: Dashboard with multiple independent data streams
const INITIAL_DASHBOARD = {
  analytics: { pageViews: 1000, uniqueUsers: 250 },
  sales: { revenue: 50000, orders: 125 },
  system: { cpu: 45, memory: 60, disk: 80 },
  notifications: { unread: 5, alerts: 2 },
  ui: { theme: 'light', sidebar: true },
};

const UPDATE_ITERATIONS = 500;

describe('Svelte 5 Runes - Complex Dashboard Reactivity', () => {
  // Baseline: Plain runes with $derived (over-reactive)
  bench('Runes $derived - complex state (over-reactive)', () => {
    const dashboard = $state(structuredClone(INITIAL_DASHBOARD));

    // Expensive computation that only needs analytics and sales data
    // Problem: Will recalculate when ANY dashboard property changes
    let expensiveComputations = 0;
    const businessMetrics = $derived(() => {
      expensiveComputations++;

      // Expensive computation combining analytics and sales
      let result = 0;
      for (let i = 0; i < 1000; i++) {
        result += Math.sqrt(
          (dashboard.analytics.pageViews + dashboard.sales.revenue) * i
        );
      }

      return {
        conversionRate:
          dashboard.sales.orders / dashboard.analytics.uniqueUsers,
        revenuePerView: dashboard.sales.revenue / dashboard.analytics.pageViews,
        expensiveMetric: result,
      };
    });

    // Update functions that match Lattice pattern
    const updateAnalytics = () => {
      dashboard.analytics.pageViews += 10;
      dashboard.analytics.uniqueUsers += 2;
    };

    const updateSales = () => {
      dashboard.sales.revenue += 1000;
      dashboard.sales.orders += 3;
    };

    const updateSystem = () => {
      dashboard.system.cpu = Math.random() * 100;
      dashboard.system.memory = Math.random() * 100;
    };

    const updateNotifications = () => {
      dashboard.notifications.unread += 1;
      dashboard.notifications.alerts = Math.floor(Math.random() * 5);
    };

    const updateUI = () => {
      dashboard.ui.theme = dashboard.ui.theme === 'light' ? 'dark' : 'light';
      dashboard.ui.sidebar = !dashboard.ui.sidebar;
    };

    // Mix of relevant and irrelevant updates
    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      const updateType = i % 5;
      switch (updateType) {
        case 0:
          updateAnalytics();
          break; // Relevant - should trigger computation
        case 1:
          updateSales();
          break; // Relevant - should trigger computation
        case 2:
          updateSystem();
          break; // Irrelevant - but WILL trigger computation
        case 3:
          updateNotifications();
          break; // Irrelevant - but WILL trigger computation
        case 4:
          updateUI();
          break; // Irrelevant - but WILL trigger computation
      }

      // Force evaluation to simulate component access
      businessMetrics;
    }
  });

  // Lattice: Fine-grained slices (prevents over-reactivity)
  bench('Lattice slices - complex state (fine-grained)', () => {
    const createSlice = createStore(INITIAL_DASHBOARD);

    // Analytics slice - only tracks analytics data
    const analyticsSlice = createSlice(
      (selectors) => ({ analytics: selectors.analytics }),
      ({ analytics }, set) => ({
        pageViews: () => analytics().pageViews,
        uniqueUsers: () => analytics().uniqueUsers,
        updateMetrics: () =>
          set(
            (selectors) => ({ analytics: selectors.analytics }),
            ({ analytics }) => ({
              analytics: {
                pageViews: analytics().pageViews + 10,
                uniqueUsers: analytics().uniqueUsers + 2,
              },
            })
          ),
      })
    );

    // Sales slice - only tracks sales data
    const salesSlice = createSlice(
      (selectors) => ({ sales: selectors.sales }),
      ({ sales }, set) => ({
        revenue: () => sales().revenue,
        orders: () => sales().orders,
        updateMetrics: () =>
          set(
            (selectors) => ({ sales: selectors.sales }),
            ({ sales }) => ({
              sales: {
                revenue: sales().revenue + 1000,
                orders: sales().orders + 3,
              },
            })
          ),
      })
    );

    // System slice - tracks system data (separate from business logic)
    const systemSlice = createSlice(
      (selectors) => ({ system: selectors.system }),
      (_, set) => ({
        updateMetrics: () =>
          set(
            (selectors) => ({ system: selectors.system }),
            () => ({
              system: {
                cpu: Math.random() * 100,
                memory: Math.random() * 100,
                disk: 80,
              },
            })
          ),
      })
    );

    // Notifications slice - separate from business logic
    const notificationsSlice = createSlice(
      (selectors) => ({ notifications: selectors.notifications }),
      (_, set) => ({
        updateMetrics: () =>
          set(
            (selectors) => ({ notifications: selectors.notifications }),
            ({ notifications }) => ({
              notifications: {
                unread: notifications().unread + 1,
                alerts: Math.floor(Math.random() * 5),
              },
            })
          ),
      })
    );

    // UI slice - separate from business logic
    const uiSlice = createSlice(
      (selectors) => ({ ui: selectors.ui }),
      (_, set) => ({
        updateTheme: () =>
          set(
            (selectors) => ({ ui: selectors.ui }),
            ({ ui }) => ({
              ui: {
                theme: ui().theme === 'light' ? 'dark' : 'light',
                sidebar: !ui().sidebar,
              },
            })
          ),
      })
    );

    // Expensive computation - ONLY depends on analytics and sales slices
    let expensiveComputations = 0;
    const businessMetrics = $derived(() => {
      const analytics = analyticsSlice();
      const sales = salesSlice();
      expensiveComputations++;

      // Same expensive computation
      let result = 0;
      for (let i = 0; i < 1000; i++) {
        result += Math.sqrt((analytics.pageViews() + sales.revenue()) * i);
      }

      return {
        conversionRate: sales.orders() / analytics.uniqueUsers(),
        revenuePerView: sales.revenue() / analytics.pageViews(),
        expensiveMetric: result,
      };
    });

    // Same update pattern - mix of relevant and irrelevant updates
    for (let i = 0; i < UPDATE_ITERATIONS; i++) {
      const updateType = i % 5;
      switch (updateType) {
        case 0:
          analyticsSlice().updateMetrics();
          break; // Relevant - will trigger computation
        case 1:
          salesSlice().updateMetrics();
          break; // Relevant - will trigger computation
        case 2:
          systemSlice().updateMetrics();
          break; // Irrelevant - WON'T trigger computation ✓
        case 3:
          notificationsSlice().updateMetrics();
          break; // Irrelevant - WON'T trigger computation ✓
        case 4:
          uiSlice().updateTheme();
          break; // Irrelevant - WON'T trigger computation ✓
      }

      // Force evaluation to simulate component access
      businessMetrics;
    }
  });
});

describe('Runes Reactivity Efficiency - Computation Analysis', () => {
  // Analysis: Count over-reactive computations with plain runes
  bench('Analysis: Runes $derived over-reactive computations', () => {
    const data = $state({
      critical: 0,
      metadata: 'info',
      config: { theme: 'light', lang: 'en' },
    });

    let computations = 0;
    const expensiveAnalysis = $derived(() => {
      computations++;
      // Expensive computation that only needs 'critical' data
      let result = 0;
      for (let i = 0; i < 2000; i++) {
        result += Math.sqrt(data.critical * i);
      }
      return {
        processedValue: result,
        timestamp: Date.now(),
      };
    });

    // Update mix: mostly irrelevant changes that trigger unnecessary computations
    for (let i = 0; i < 150; i++) {
      if (i % 4 === 0) {
        data.critical++; // Relevant - should trigger computation
      } else if (i % 4 === 1) {
        data.metadata = `info-${i}`; // Irrelevant - but WILL trigger computation
      } else if (i % 4 === 2) {
        data.config.theme = data.config.theme === 'light' ? 'dark' : 'light'; // Irrelevant - but WILL trigger
      } else {
        data.config.lang = `lang-${i % 3}`; // Irrelevant - but WILL trigger
      }

      expensiveAnalysis; // Force evaluation
    }
  });

  // Analysis: Count fine-grained computations with Lattice slices
  bench('Analysis: Lattice slices fine-grained computations', () => {
    const createSlice = createStore({
      critical: 0,
      metadata: 'info',
      config: { theme: 'light', lang: 'en' },
    });

    // Critical data slice - only tracks what matters for computation
    const criticalSlice = createSlice(
      (selectors) => ({ critical: selectors.critical }),
      ({ critical }, set) => ({
        value: () => critical(),
        increment: () =>
          set(
            (selectors) => ({ critical: selectors.critical }),
            ({ critical }) => ({ critical: critical() + 1 })
          ),
      })
    );

    // Metadata slice - separate from critical computation
    const metadataSlice = createSlice(
      (selectors) => ({ metadata: selectors.metadata }),
      (_, set) => ({
        update: (value: string) =>
          set(
            (selectors) => ({ metadata: selectors.metadata }),
            () => ({ metadata: value })
          ),
      })
    );

    // Config slice - separate from critical computation
    const configSlice = createSlice(
      (selectors) => ({ config: selectors.config }),
      (_, set) => ({
        updateTheme: () =>
          set(
            (selectors) => ({ config: selectors.config }),
            ({ config }) => ({
              config: {
                ...config(),
                theme: config().theme === 'light' ? 'dark' : 'light',
              },
            })
          ),
        updateLang: (lang: string) =>
          set(
            (selectors) => ({ config: selectors.config }),
            ({ config }) => ({
              config: { ...config(), lang },
            })
          ),
      })
    );

    let computations = 0;
    const expensiveAnalysis = $derived(() => {
      const critical = criticalSlice();
      computations++;
      // Same expensive computation - only depends on critical slice
      let result = 0;
      for (let i = 0; i < 2000; i++) {
        result += Math.sqrt(critical.value() * i);
      }
      return {
        processedValue: result,
        timestamp: Date.now(),
      };
    });

    // Same update pattern - but irrelevant changes don't trigger computation
    for (let i = 0; i < 150; i++) {
      if (i % 4 === 0) {
        criticalSlice().increment(); // Relevant - will trigger computation
      } else if (i % 4 === 1) {
        metadataSlice().update(`info-${i}`); // Irrelevant - WON'T trigger computation ✓
      } else if (i % 4 === 2) {
        configSlice().updateTheme(); // Irrelevant - WON'T trigger computation ✓
      } else {
        configSlice().updateLang(`lang-${i % 3}`); // Irrelevant - WON'T trigger computation ✓
      }

      expensiveAnalysis; // Access - only recalculates when needed
    }
  });
});
