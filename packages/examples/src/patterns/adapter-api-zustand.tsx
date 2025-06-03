/**
 * @fileoverview Adapter-Specific Features - Zustand Example
 *
 * This example demonstrates how to properly use features exposed by the Zustand adapter.
 * 
 * Key principles:
 * - Components remain adapter-agnostic - no adapter-specific code in slices
 * - Adapter-specific features are accessed through the adapter result
 * - The `api` parameter in slices only uses universal APIs (getState, executeSlice)
 * - Middleware can extend capabilities but should remain adapter-agnostic
 * 
 * What this example demonstrates:
 * 1. Using compose() for proper slice composition
 * 2. Using api.getState() within action implementations (universal API)
 * 3. View-based subscriptions through store.subscribe() (Zustand adapter feature)
 * 4. Proper separation between universal components and adapter-specific usage
 */

import React from 'react';
import {
  createComponent,
  createModel,
  createSlice,
  compose,
} from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useViews, useActions } from '@lattice/adapter-zustand/react';

// ============================================================================
// Analytics Component - Completely adapter-agnostic
// ============================================================================
const analyticsComponent = createComponent(() => {
  const model = createModel<{
    // User activity
    pageViews: number;
    clickEvents: number;
    lastActivity: number;
    sessionStart: number;

    // Performance metrics
    metrics: {
      renderCount: number;
      stateUpdates: number;
    };

    // Feature usage
    featuresUsed: Set<string>;

    // Actions
    trackPageView: () => void;
    trackClick: (element: string) => void;
    trackFeatureUsage: (feature: string) => void;
    resetSession: () => void;
    incrementRenderCount: () => void;
  }>(({ set, get }) => ({
    // Initial state
    pageViews: 0,
    clickEvents: 0,
    lastActivity: Date.now(),
    sessionStart: Date.now(),
    metrics: {
      renderCount: 0,
      stateUpdates: 0,
    },
    featuresUsed: new Set(),

    // Actions
    trackPageView: () => {
      set({
        pageViews: get().pageViews + 1,
        lastActivity: Date.now(),
        metrics: {
          ...get().metrics,
          stateUpdates: get().metrics.stateUpdates + 1,
        },
      });
    },

    trackClick: (element) => {
      console.log(`[Analytics] Click on: ${element}`);
      set({
        clickEvents: get().clickEvents + 1,
        lastActivity: Date.now(),
        metrics: {
          ...get().metrics,
          stateUpdates: get().metrics.stateUpdates + 1,
        },
      });
    },

    trackFeatureUsage: (feature) => {
      const features = new Set(get().featuresUsed);
      features.add(feature);
      set({
        featuresUsed: features,
        lastActivity: Date.now(),
      });
    },

    resetSession: () => {
      set({
        pageViews: 0,
        clickEvents: 0,
        lastActivity: Date.now(),
        sessionStart: Date.now(),
        featuresUsed: new Set(),
        metrics: {
          renderCount: 0,
          stateUpdates: 0,
        },
      });
    },

    incrementRenderCount: () => {
      set({
        metrics: {
          ...get().metrics,
          renderCount: get().metrics.renderCount + 1,
        },
      });
    },
  }));

  // Basic view slice
  const dashboardSlice = createSlice(model, (m) => ({
    pageViews: m.pageViews,
    clickEvents: m.clickEvents,
    sessionDuration: Date.now() - m.sessionStart,
    lastActivityAgo: Date.now() - m.lastActivity,
    metrics: m.metrics,
    featuresUsed: Array.from(m.featuresUsed),
  }));

  // Demonstrating proper slice composition with compose()
  const realtimeMetricsSlice = createSlice(
    model,
    compose(
      { dashboard: dashboardSlice },
      (m, { dashboard }) => ({
        renderCount: m.metrics.renderCount,
        stateUpdates: m.metrics.stateUpdates,
        updateRate:
          m.metrics.stateUpdates > 0
            ? (m.metrics.stateUpdates / (dashboard.sessionDuration / 1000)).toFixed(2)
            : '0',
        // Computed value using data from another slice
        totalInteractions: dashboard.pageViews + dashboard.clickEvents,
      })
    )
  );

  // Using compose() for dependency injection
  const summarySlice = createSlice(
    model,
    compose(
      { dashboard: dashboardSlice, realtime: realtimeMetricsSlice },
      (_, { dashboard, realtime }) => ({
        summary: `${dashboard.pageViews} page views, ${dashboard.clickEvents} clicks`,
        performance: `${realtime.updateRate} updates/sec`,
        isActive: dashboard.lastActivityAgo < 30000,
        featureCount: dashboard.featuresUsed.length,
      })
    )
  );

  const featureTrackingSlice = createSlice(model, (m) => ({
    featuresUsed: Array.from(m.featuresUsed),
    featureCount: m.featuresUsed.size,
    mostRecentFeature: Array.from(m.featuresUsed).pop() || 'None',
  }));

  // Actions slice - only uses universal API features
  const actions = createSlice(model, (m, api) => ({
    trackPageView: () => {
      m.trackPageView();
      m.trackFeatureUsage('page-navigation');
    },

    trackClick: (element: string) => {
      m.trackClick(element);
      m.trackFeatureUsage(`click-${element}`);
    },

    resetSession: () => {
      m.resetSession();
    },

    incrementRenderCount: () => {
      m.incrementRenderCount();
    },

    // Using api.getState() - a universal API feature
    logCurrentState: () => {
      const state = api.getState();
      console.log('[Analytics] Current state:', {
        pageViews: state.pageViews,
        clickEvents: state.clickEvents,
        featuresUsed: Array.from(state.featuresUsed),
      });
    },

    // Conditional logic using universal API
    trackSmartClick: (element: string) => {
      const currentClicks = api.getState().clickEvents;
      if (currentClicks >= 10) {
        console.log('[Analytics] High activity detected!');
        m.trackFeatureUsage('high-activity');
      }
      m.trackClick(element);
    },
  }));

  return {
    model,
    actions,
    views: {
      dashboard: dashboardSlice,
      realtime: realtimeMetricsSlice,
      features: featureTrackingSlice,
      summary: summarySlice,
    },
  };
});

// ============================================================================
// Create Store - This is where adapter-specific features are used
// ============================================================================
const analyticsStore = createZustandAdapter(analyticsComponent);

// NOTE: If you wanted adapter-specific middleware, it would go here:
// const analyticsStore = createZustandAdapter(
//   withZustandDevtools(analyticsComponent)
// );

// ============================================================================
// React Components - Using adapter-specific features properly
// ============================================================================

function Dashboard() {
  const dashboard = useViews(analyticsStore, (views) => views.dashboard());

  return (
    <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
      <h3>Analytics Dashboard</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <strong>Page Views:</strong> {dashboard.pageViews}
        </div>
        <div>
          <strong>Click Events:</strong> {dashboard.clickEvents}
        </div>
        <div>
          <strong>Session Duration:</strong>{' '}
          {Math.floor(dashboard.sessionDuration / 1000)}s
        </div>
        <div>
          <strong>Last Activity:</strong>{' '}
          {Math.floor(dashboard.lastActivityAgo / 1000)}s ago
        </div>
      </div>
    </div>
  );
}

function RealtimeMetrics() {
  const metrics = useViews(analyticsStore, (views) => views.realtime());

  // Track render count properly in useEffect
  React.useEffect(() => {
    analyticsStore.actions.incrementRenderCount();
  });

  return (
    <div style={{ background: '#e8f4f8', padding: '15px', borderRadius: '8px' }}>
      <h3>Real-time Metrics</h3>
      <div style={{ fontFamily: 'monospace' }}>
        <div>Render Count: {metrics.renderCount}</div>
        <div>State Updates: {metrics.stateUpdates}</div>
        <div>Update Rate: {metrics.updateRate} updates/sec</div>
        <div>Total Interactions: {metrics.totalInteractions}</div>
      </div>
    </div>
  );
}

function SummaryView() {
  const summary = useViews(analyticsStore, (views) => views.summary());

  return (
    <div style={{ background: '#e8f8e8', padding: '15px', borderRadius: '8px' }}>
      <h3>Summary View (Composed)</h3>
      <p>{summary.summary}</p>
      <p>Performance: {summary.performance}</p>
      <p>Status: {summary.isActive ? '🟢 Active' : '⚪ Inactive'}</p>
      <p>Features used: {summary.featureCount}</p>
    </div>
  );
}

function FeatureUsage() {
  const features = useViews(analyticsStore, (views) => views.features());

  return (
    <div style={{ background: '#f0e8ff', padding: '15px', borderRadius: '8px' }}>
      <h3>Feature Usage Tracking</h3>
      <p>Total Features Used: {features.featureCount}</p>
      <p>Most Recent: {features.mostRecentFeature}</p>
      {features.featuresUsed.length > 0 && (
        <details>
          <summary>All Features ({features.featuresUsed.length})</summary>
          <ul style={{ fontSize: '0.9em' }}>
            {features.featuresUsed.map((feature, i) => (
              <li key={i}>{feature}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function InteractiveDemo() {
  const actions = useActions(analyticsStore);

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>Interactive Demo</h3>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={() => actions.trackPageView()}>
          Simulate Page View
        </button>
        <button onClick={() => actions.trackClick('demo-button')}>
          Track Click
        </button>
        <button onClick={() => actions.trackSmartClick('special-feature')}>
          Smart Click (logs at 10+ clicks)
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => actions.logCurrentState()}>
          Log Current State
        </button>
        <button onClick={() => actions.resetSession()}>
          Reset Session
        </button>
      </div>
    </div>
  );
}

// Demonstrating Zustand-specific features: view-based subscriptions
function SubscriptionDemo() {
  const [updates, setUpdates] = React.useState<string[]>([]);

  React.useEffect(() => {
    // Using Zustand adapter's subscribe method - an adapter-specific feature
    const unsubscribe = analyticsStore.subscribe(
      (views) => ({
        pageViews: views.dashboard().pageViews,
        clickEvents: views.dashboard().clickEvents,
      }),
      (state) => {
        const timestamp = new Date().toLocaleTimeString();
        setUpdates(prev => [
          ...prev.slice(-4), // Keep last 5 updates
          `${timestamp}: Views=${state.pageViews}, Clicks=${state.clickEvents}`
        ]);
      }
    );

    return unsubscribe;
  }, []);

  return (
    <div style={{ background: '#fff8e1', padding: '15px', borderRadius: '8px' }}>
      <h3>Zustand Feature: View Subscriptions</h3>
      <p style={{ fontSize: '0.9em', marginBottom: '10px' }}>
        The Zustand adapter provides a subscribe() method for reactive updates:
      </p>
      <div style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
        {updates.length === 0 ? (
          <div>Waiting for updates...</div>
        ) : (
          updates.map((update, i) => <div key={i}>{update}</div>)
        )}
      </div>
    </div>
  );
}

// Demonstrating how to check for adapter-specific features
function AdapterFeatureDetection() {
  const hasSubscribe = 'subscribe' in analyticsStore && 
    typeof analyticsStore.subscribe === 'function';
  
  return (
    <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px' }}>
      <h3>Adapter Feature Detection</h3>
      <p>Current adapter provides:</p>
      <ul style={{ fontSize: '0.9em' }}>
        <li>✓ actions</li>
        <li>✓ views</li>
        <li>{hasSubscribe ? '✓' : '✗'} subscribe (Zustand-specific)</li>
      </ul>
      <p style={{ fontSize: '0.85em', color: '#666', marginTop: '10px' }}>
        Components remain portable - adapter features are used only at the edges.
      </p>
    </div>
  );
}

export function AdapterAPIExample() {
  // Force re-render periodically to show real-time updates
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    const interval = setInterval(forceUpdate, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Adapter-Specific Features - Zustand Example</h1>

      <div style={{ display: 'grid', gap: '20px' }}>
        <Dashboard />
        <RealtimeMetrics />
        <SummaryView />
        <FeatureUsage />
        <SubscriptionDemo />
        <AdapterFeatureDetection />
        <InteractiveDemo />
      </div>

      <div
        style={{
          marginTop: '40px',
          padding: '15px',
          background: '#fffbf0',
          borderRadius: '8px',
        }}
      >
        <h3>Key Architecture Principles:</h3>
        <ul>
          <li>
            <strong>Components are adapter-agnostic:</strong> No adapter-specific code in slices
          </li>
          <li>
            <strong>Universal API only:</strong> Slices only use api.getState() and api.executeSlice()
          </li>
          <li>
            <strong>Adapter features at the edges:</strong> Use adapter-specific features in React components, not in component definitions
          </li>
          <li>
            <strong>Middleware at adapter level:</strong> Adapter-specific middleware wraps the adapter, not the component
          </li>
          <li>
            <strong>Portability preserved:</strong> The same component works with any adapter
          </li>
        </ul>

        <h4 style={{ marginTop: '20px' }}>Correct Patterns:</h4>
        <ul>
          <li>✓ Use compose() for slice composition</li>
          <li>✓ Use universal api.getState() in actions</li>
          <li>✓ Access adapter features through the adapter result</li>
          <li>✓ Apply adapter middleware at creation: createZustandAdapter(middleware(component))</li>
        </ul>

        <h4 style={{ marginTop: '20px' }}>Anti-patterns to Avoid:</h4>
        <ul>
          <li>✗ Using adapter-specific APIs in slices</li>
          <li>✗ Type-casting api to adapter-specific types</li>
          <li>✗ Using api.executeSlice() for composition (use compose() instead)</li>
          <li>✗ Accessing internal adapter properties</li>
          <li>✗ Coupling component definitions to specific adapters</li>
        </ul>

        <p style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
          This example shows how the Zustand adapter exposes its subscribe() method
          while keeping the component definition completely portable. The same
          analyticsComponent could be used with Redux, MobX, or any other adapter.
        </p>
      </div>
    </div>
  );
}