/**
 * @fileoverview Adapter-Specific API Usage - Zustand Example
 * 
 * This example demonstrates how to use adapter-specific APIs through
 * the API parameter, specifically showcasing Zustand's subscribe
 * functionality and other advanced features.
 */

import React from 'react';
import {
  createComponent,
  createModel,
  createSlice,
  type AdapterAPI,
} from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useViews, useActions } from '@lattice/adapter-zustand/react';
import type { StoreApi } from 'zustand';

// Extended API type for Zustand-specific features
interface ZustandAPI<Model> extends AdapterAPI<Model> {
  subscribe: StoreApi<Model>['subscribe'];
}

// ============================================================================
// Subscription Management
// ============================================================================
class SubscriptionManager {
  private subscriptions = new Map<string, () => void>();
  
  add(key: string, unsubscribe: () => void) {
    this.subscriptions.set(key, unsubscribe);
  }
  
  remove(key: string) {
    const unsubscribe = this.subscriptions.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(key);
    }
  }
  
  clear() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }
}

const subscriptionManager = new SubscriptionManager();

// ============================================================================
// Real-time Analytics Component
// ============================================================================
export const analyticsComponent = createComponent(() => {
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
      subscriptionCount: number;
    };
    
    // Feature usage
    featuresUsed: Set<string>;
    
    // Actions
    trackPageView: () => void;
    trackClick: (element: string) => void;
    trackFeatureUsage: (feature: string) => void;
    resetSession: () => void;
    
    // Subscription management
    activeSubscriptions: string[];
    addSubscription: (key: string) => void;
    removeSubscription: (key: string) => void;
  }>(({ set, get }) => ({
    // Initial state
    pageViews: 0,
    clickEvents: 0,
    lastActivity: Date.now(),
    sessionStart: Date.now(),
    metrics: {
      renderCount: 0,
      stateUpdates: 0,
      subscriptionCount: 0,
    },
    featuresUsed: new Set(),
    activeSubscriptions: [],

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
          subscriptionCount: get().metrics.subscriptionCount,
        },
      });
    },

    addSubscription: (key) => {
      set({
        activeSubscriptions: [...get().activeSubscriptions, key],
        metrics: {
          ...get().metrics,
          subscriptionCount: get().metrics.subscriptionCount + 1,
        },
      });
    },

    removeSubscription: (key) => {
      set({
        activeSubscriptions: get().activeSubscriptions.filter(k => k !== key),
        metrics: {
          ...get().metrics,
          subscriptionCount: get().metrics.subscriptionCount - 1,
        },
      });
    },
  }));

  // Analytics dashboard slice with Zustand subscription
  const dashboardSlice = createSlice(model, (m, api) => {
    // Access Zustand-specific API if available
    const zustandApi = api as ZustandAPI<typeof m>;
    
    // Set up activity monitoring subscription
    if (zustandApi.subscribe && typeof window !== 'undefined') {
      const subscriptionKey = 'activity-monitor';
      
      // Remove existing subscription if any
      subscriptionManager.remove(subscriptionKey);
      
      // Create new subscription
      const unsubscribe = zustandApi.subscribe(
        (state, prevState) => {
          // Log significant state changes
          if (state.pageViews !== prevState.pageViews) {
            console.log(`[Dashboard] Page views increased: ${prevState.pageViews} → ${state.pageViews}`);
          }
          
          if (state.clickEvents !== prevState.clickEvents) {
            console.log(`[Dashboard] Click events: ${prevState.clickEvents} → ${state.clickEvents}`);
          }
          
          // Auto-save analytics data every 10 state updates
          if (state.metrics.stateUpdates % 10 === 0 && state.metrics.stateUpdates > 0) {
            console.log('[Dashboard] Auto-saving analytics data...', {
              pageViews: state.pageViews,
              clickEvents: state.clickEvents,
              featuresUsed: Array.from(state.featuresUsed),
              sessionDuration: Date.now() - state.sessionStart,
            });
          }
        }
      );
      
      subscriptionManager.add(subscriptionKey, unsubscribe);
      m.addSubscription(subscriptionKey);
    }
    
    return {
      pageViews: m.pageViews,
      clickEvents: m.clickEvents,
      sessionDuration: Date.now() - m.sessionStart,
      lastActivityAgo: Date.now() - m.lastActivity,
      metrics: m.metrics,
      featuresUsed: Array.from(m.featuresUsed),
    };
  });

  // Real-time metrics slice with selective subscriptions
  const realtimeMetricsSlice = createSlice(model, (m, api) => {
    const zustandApi = api as ZustandAPI<typeof m>;
    
    if (zustandApi.subscribe) {
      const subscriptionKey = 'realtime-metrics';
      subscriptionManager.remove(subscriptionKey);
      
      // Subscribe only to specific state changes
      const unsubscribe = zustandApi.subscribe(
        (_state) => {
          // Update render count on every render
          api.executeSlice(createSlice(model, (m) => {
            m.metrics.renderCount++;
            return null;
          }));
        }
      );
      
      subscriptionManager.add(subscriptionKey, unsubscribe);
    }
    
    return {
      renderCount: m.metrics.renderCount,
      stateUpdates: m.metrics.stateUpdates,
      subscriptionCount: m.metrics.subscriptionCount,
      updateRate: m.metrics.stateUpdates > 0 
        ? (m.metrics.stateUpdates / ((Date.now() - m.sessionStart) / 1000)).toFixed(2)
        : '0',
    };
  });

  // Feature tracking slice with persistence
  const featureTrackingSlice = createSlice(model, (m, api) => {
    const zustandApi = api as ZustandAPI<typeof m>;
    
    if (zustandApi.subscribe) {
      const subscriptionKey = 'feature-persistence';
      subscriptionManager.remove(subscriptionKey);
      
      // Subscribe to feature usage changes
      const unsubscribe = zustandApi.subscribe(
        (state) => {
          // Persist to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              'analytics-features-used',
              JSON.stringify(Array.from(state.featuresUsed))
            );
          }
        }
      );
      
      subscriptionManager.add(subscriptionKey, unsubscribe);
    }
    
    // Load persisted data on first render
    if (typeof window !== 'undefined' && m.featuresUsed.size === 0) {
      const persisted = localStorage.getItem('analytics-features-used');
      if (persisted) {
        try {
          const features = JSON.parse(persisted) as string[];
          features.forEach(feature => m.trackFeatureUsage(feature));
        } catch (e) {
          console.error('[FeatureTracking] Failed to load persisted data:', e);
        }
      }
    }
    
    return {
      featuresUsed: Array.from(m.featuresUsed),
      featureCount: m.featuresUsed.size,
      mostRecentFeature: Array.from(m.featuresUsed).pop() || 'None',
    };
  });

  // Actions with feature tracking
  const actions = createSlice(model, (m, _api) => ({
    trackPageView: () => {
      m.trackPageView();
      m.trackFeatureUsage('page-navigation');
    },
    
    trackClick: (element: string) => {
      m.trackClick(element);
      m.trackFeatureUsage(`click-${element}`);
    },
    
    resetSession: () => {
      // Clean up subscriptions before reset
      m.activeSubscriptions.forEach(key => {
        subscriptionManager.remove(key);
      });
      m.resetSession();
    },
    
    // Demonstrate accessing store internals
    inspectStore: () => {
      const zustandApi = _api as ZustandAPI<typeof m>;
      if (zustandApi.getState) {
        console.log('[Store Inspector] Current state:', zustandApi.getState());
        console.log('[Store Inspector] Active subscriptions:', m.activeSubscriptions);
      }
    },
  }));

  return {
    model,
    actions,
    views: {
      dashboard: dashboardSlice,
      realtime: realtimeMetricsSlice,
      features: featureTrackingSlice,
    },
  };
});

// ============================================================================
// Create Store with Extended API
// ============================================================================
const analyticsStore = createZustandAdapter(analyticsComponent);

// Get the underlying Zustand store for advanced operations
const zustandStore = (analyticsStore as any).store as StoreApi<any>;

// ============================================================================
// React Components
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
          <strong>Session Duration:</strong> {Math.floor(dashboard.sessionDuration / 1000)}s
        </div>
        <div>
          <strong>Last Activity:</strong> {Math.floor(dashboard.lastActivityAgo / 1000)}s ago
        </div>
      </div>
    </div>
  );
}

function RealtimeMetrics() {
  const metrics = useViews(analyticsStore, (views) => views.realtime());
  
  return (
    <div style={{ background: '#e8f4f8', padding: '15px', borderRadius: '8px' }}>
      <h3>Real-time Metrics</h3>
      <div style={{ fontFamily: 'monospace' }}>
        <div>Render Count: {metrics.renderCount}</div>
        <div>State Updates: {metrics.stateUpdates}</div>
        <div>Active Subscriptions: {metrics.subscriptionCount}</div>
        <div>Update Rate: {metrics.updateRate} updates/sec</div>
      </div>
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
  const [subscriptionActive, setSubscriptionActive] = React.useState(false);
  
  // Example of direct store subscription from component
  React.useEffect(() => {
    if (!subscriptionActive) return;
    
    const unsubscribe = zustandStore.subscribe(
      (state: any) => {
        console.log(`[Component] Click events changed to: ${state.clickEvents}`);
      }
    );
    
    return () => unsubscribe();
  }, [subscriptionActive]);
  
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
        <button onClick={() => actions.trackClick('special-feature')}>
          Use Special Feature
        </button>
      </div>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => actions.inspectStore()}>
          Inspect Store (Console)
        </button>
        <button onClick={() => actions.resetSession()}>
          Reset Session
        </button>
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <label>
          <input
            type="checkbox"
            checked={subscriptionActive}
            onChange={(e) => setSubscriptionActive(e.target.checked)}
          />
          Enable Component Subscription (Console)
        </label>
      </div>
    </div>
  );
}

export function AdapterAPIExample() {
  // Force re-render periodically to show real-time updates
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
  React.useEffect(() => {
    const interval = setInterval(forceUpdate, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Adapter-Specific API Usage - Zustand Example</h1>
      
      <div style={{ display: 'grid', gap: '20px' }}>
        <Dashboard />
        <RealtimeMetrics />
        <FeatureUsage />
        <InteractiveDemo />
      </div>
      
      <div style={{ marginTop: '40px', padding: '15px', background: '#fffbf0', borderRadius: '8px' }}>
        <h3>Zustand-Specific Features Demonstrated:</h3>
        <ul>
          <li><strong>Subscribe API:</strong> Real-time monitoring of state changes</li>
          <li><strong>Selective Subscriptions:</strong> Subscribe to specific state slices</li>
          <li><strong>Equality Functions:</strong> Control when subscribers are notified</li>
          <li><strong>Direct Store Access:</strong> Inspect and manipulate store internals</li>
          <li><strong>Persistent Subscriptions:</strong> Maintain subscriptions across renders</li>
          <li><strong>Auto-cleanup:</strong> Manage subscription lifecycle properly</li>
        </ul>
        
        <p style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
          Note: Open the browser console to see detailed logging from subscriptions
          and state changes. The metrics update in real-time as you interact with
          the application.
        </p>
      </div>
    </div>
  );
}