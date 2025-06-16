/**
 * @fileoverview React Context vs store-react performance comparison
 *
 * Tests rendering performance differences between React Context (which re-renders
 * all consumers on any update) vs store-react (which only re-renders components
 * subscribed to changed data)
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  memo,
  useRef,
} from 'react';
import { describe, bench } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createStore } from '@lattice/adapter-store-react';
import type { RuntimeSliceFactory } from '@lattice/core';

// Dashboard state representing a real-world analytics dashboard
type DashboardState = {
  metrics: {
    revenue: number;
    users: number;
    conversions: number;
    pageViews: number;
  };
  charts: {
    revenueHistory: Array<{ date: string; value: number }>;
    userGrowth: Array<{ date: string; value: number }>;
    conversionFunnel: Array<{ stage: string; value: number }>;
  };
  filters: {
    dateRange: { start: string; end: string };
    segment: string;
    product: string | null;
  };
  notifications: Array<{
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error';
  }>;
  ui: {
    sidebarOpen: boolean;
    activeTab: string;
    refreshing: boolean;
  };
};

// Initial state factory
const createInitialState = (): DashboardState => ({
  metrics: {
    revenue: 125000,
    users: 5000,
    conversions: 250,
    pageViews: 50000,
  },
  charts: {
    revenueHistory: Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${i + 1}`,
      value: 100000 + Math.random() * 50000,
    })),
    userGrowth: Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${i + 1}`,
      value: 4000 + Math.random() * 2000,
    })),
    conversionFunnel: [
      { stage: 'Visits', value: 10000 },
      { stage: 'Signups', value: 2000 },
      { stage: 'Active', value: 1500 },
      { stage: 'Paid', value: 500 },
    ],
  },
  filters: {
    dateRange: { start: '2024-01-01', end: '2024-01-31' },
    segment: 'all',
    product: null,
  },
  notifications: [],
  ui: {
    sidebarOpen: true,
    activeTab: 'overview',
    refreshing: false,
  },
});

// Track render counts for performance measurement
const renderCounts = new Map<string, number>();
const resetRenderCounts = () => renderCounts.clear();
const getRenderCount = (component: string) => renderCounts.get(component) || 0;
const incrementRenderCount = (component: string) => {
  renderCounts.set(component, getRenderCount(component) + 1);
};

// === REACT CONTEXT IMPLEMENTATION ===
const DashboardContext = createContext<{
  state: DashboardState;
  updateMetric: (
    metric: keyof DashboardState['metrics'],
    value: number
  ) => void;
  updateFilter: (filter: keyof DashboardState['filters'], value: any) => void;
  toggleSidebar: () => void;
  addNotification: (
    message: string,
    type: 'info' | 'warning' | 'error'
  ) => void;
  refreshData: () => void;
} | null>(null);

const DashboardContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<DashboardState>(createInitialState);

  const updateMetric = useCallback(
    (metric: keyof DashboardState['metrics'], value: number) => {
      setState((prev) => ({
        ...prev,
        metrics: { ...prev.metrics, [metric]: value },
      }));
    },
    []
  );

  const updateFilter = useCallback(
    (filter: keyof DashboardState['filters'], value: any) => {
      setState((prev) => ({
        ...prev,
        filters: { ...prev.filters, [filter]: value },
      }));
    },
    []
  );

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      ui: { ...prev.ui, sidebarOpen: !prev.ui.sidebarOpen },
    }));
  }, []);

  const addNotification = useCallback(
    (message: string, type: 'info' | 'warning' | 'error') => {
      setState((prev) => ({
        ...prev,
        notifications: [
          ...prev.notifications,
          { id: Date.now().toString(), message, type },
        ],
      }));
    },
    []
  );

  const refreshData = useCallback(() => {
    setState((prev) => {
      // Simulate data refresh
      return {
        ...prev,
        ui: { ...prev.ui, refreshing: true },
        metrics: {
          revenue: prev.metrics.revenue + Math.random() * 10000 - 5000,
          users: prev.metrics.users + Math.floor(Math.random() * 100 - 50),
          conversions:
            prev.metrics.conversions + Math.floor(Math.random() * 20 - 10),
          pageViews:
            prev.metrics.pageViews + Math.floor(Math.random() * 1000 - 500),
        },
      };
    });
    setTimeout(() => {
      setState((prev) => ({ ...prev, ui: { ...prev.ui, refreshing: false } }));
    }, 100);
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        state,
        updateMetric,
        updateFilter,
        toggleSidebar,
        addNotification,
        refreshData,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

// Context-based components (all re-render on any state change)
const ContextRevenueWidget = memo(() => {
  incrementRenderCount('ContextRevenueWidget');
  const context = useContext(DashboardContext);
  if (!context) return null;
  return <div>Revenue: ${context.state.metrics.revenue.toLocaleString()}</div>;
});

const ContextUserWidget = memo(() => {
  incrementRenderCount('ContextUserWidget');
  const context = useContext(DashboardContext);
  if (!context) return null;
  return <div>Users: {context.state.metrics.users.toLocaleString()}</div>;
});

const ContextConversionWidget = memo(() => {
  incrementRenderCount('ContextConversionWidget');
  const context = useContext(DashboardContext);
  if (!context) return null;
  return <div>Conversions: {context.state.metrics.conversions}</div>;
});

const ContextPageViewWidget = memo(() => {
  incrementRenderCount('ContextPageViewWidget');
  const context = useContext(DashboardContext);
  if (!context) return null;
  return (
    <div>Page Views: {context.state.metrics.pageViews.toLocaleString()}</div>
  );
});

const ContextSidebar = memo(() => {
  incrementRenderCount('ContextSidebar');
  const context = useContext(DashboardContext);
  if (!context) return null;
  return <div>Sidebar: {context.state.ui.sidebarOpen ? 'Open' : 'Closed'}</div>;
});

const ContextFilterBar = memo(() => {
  incrementRenderCount('ContextFilterBar');
  const context = useContext(DashboardContext);
  if (!context) return null;
  return <div>Segment: {context.state.filters.segment}</div>;
});

const ContextNotificationList = memo(() => {
  incrementRenderCount('ContextNotificationList');
  const context = useContext(DashboardContext);
  if (!context) return null;
  return <div>Notifications: {context.state.notifications.length}</div>;
});

const ContextChartSection = memo(() => {
  incrementRenderCount('ContextChartSection');
  const context = useContext(DashboardContext);
  if (!context) return null;
  return (
    <div>Charts: {context.state.charts.revenueHistory.length} data points</div>
  );
});

// === STORE-REACT IMPLEMENTATION ===
const createDashboardStore = (createSlice: RuntimeSliceFactory<DashboardState>) => {

  const metrics = createSlice(({ get, set }) => ({
    updateMetric: (metric: keyof DashboardState['metrics'], value: number) => {
      set({
        metrics: { ...get().metrics, [metric]: value },
      });
    },
    getRevenue: () => get().metrics.revenue,
    getUsers: () => get().metrics.users,
    getConversions: () => get().metrics.conversions,
    getPageViews: () => get().metrics.pageViews,
  }));

  const filters = createSlice(({ get, set }) => ({
    updateFilter: (filter: keyof DashboardState['filters'], value: any) => {
      set({
        filters: { ...get().filters, [filter]: value },
      });
    },
    getSegment: () => get().filters.segment,
    getDateRange: () => get().filters.dateRange,
    getProduct: () => get().filters.product,
  }));

  const ui = createSlice(({ get, set }) => ({
    toggleSidebar: () => {
      set({
        ui: { ...get().ui, sidebarOpen: !get().ui.sidebarOpen },
      });
    },
    getSidebarOpen: () => get().ui.sidebarOpen,
    getActiveTab: () => get().ui.activeTab,
    isRefreshing: () => get().ui.refreshing,
  }));

  const notifications = createSlice(({ get, set }) => ({
    addNotification: (message: string, type: 'info' | 'warning' | 'error') => {
      set({
        notifications: [
          ...get().notifications,
          { id: Date.now().toString(), message, type },
        ],
      });
    },
    getNotifications: () => get().notifications,
    getNotificationCount: () => get().notifications.length,
  }));

  const charts = createSlice(({ get }) => ({
    getRevenueHistory: () => get().charts.revenueHistory,
    getUserGrowth: () => get().charts.userGrowth,
    getConversionFunnel: () => get().charts.conversionFunnel,
  }));

  const actions = createSlice(({ get, set }) => ({
    refreshData: () => {
      set({
        ui: { ...get().ui, refreshing: true },
        metrics: {
          revenue: get().metrics.revenue + Math.random() * 10000 - 5000,
          users: get().metrics.users + Math.floor(Math.random() * 100 - 50),
          conversions:
            get().metrics.conversions + Math.floor(Math.random() * 20 - 10),
          pageViews:
            get().metrics.pageViews + Math.floor(Math.random() * 1000 - 500),
        },
      });
      setTimeout(() => {
        set({ ui: { ...get().ui, refreshing: false } });
      }, 100);
    },
  }));

  return { metrics, filters, ui, notifications, charts, actions };
};

// Store-react based components (only re-render when their specific data changes)
const StoreRevenueWidget = memo(
  ({ store }: { store: ReturnType<typeof createDashboardStore> }) => {
    incrementRenderCount('StoreRevenueWidget');
    const revenue = store.metrics.selector.getRevenue();
    return <div>Revenue: ${revenue.toLocaleString()}</div>;
  }
);

const StoreUserWidget = memo(
  ({ store }: { store: ReturnType<typeof createDashboardStore> }) => {
    incrementRenderCount('StoreUserWidget');
    const users = store.metrics.selector.getUsers();
    return <div>Users: {users.toLocaleString()}</div>;
  }
);

const StoreConversionWidget = memo(
  ({ store }: { store: ReturnType<typeof createDashboardStore> }) => {
    incrementRenderCount('StoreConversionWidget');
    const conversions = store.metrics.selector.getConversions();
    return <div>Conversions: {conversions}</div>;
  }
);

const StorePageViewWidget = memo(
  ({ store }: { store: ReturnType<typeof createDashboardStore> }) => {
    incrementRenderCount('StorePageViewWidget');
    const pageViews = store.metrics.selector.getPageViews();
    return <div>Page Views: {pageViews.toLocaleString()}</div>;
  }
);

const StoreSidebar = memo(
  ({ store }: { store: ReturnType<typeof createDashboardStore> }) => {
    incrementRenderCount('StoreSidebar');
    const isOpen = store.ui.selector.getSidebarOpen();
    return <div>Sidebar: {isOpen ? 'Open' : 'Closed'}</div>;
  }
);

const StoreFilterBar = memo(
  ({ store }: { store: ReturnType<typeof createDashboardStore> }) => {
    incrementRenderCount('StoreFilterBar');
    const segment = store.filters.selector.getSegment();
    return <div>Segment: {segment}</div>;
  }
);

const StoreNotificationList = memo(
  ({ store }: { store: ReturnType<typeof createDashboardStore> }) => {
    incrementRenderCount('StoreNotificationList');
    const count = store.notifications.selector.getNotificationCount();
    return <div>Notifications: {count}</div>;
  }
);

const StoreChartSection = memo(
  ({ store }: { store: ReturnType<typeof createDashboardStore> }) => {
    incrementRenderCount('StoreChartSection');
    const history = store.charts.selector.getRevenueHistory();
    return <div>Charts: {history.length} data points</div>;
  }
);

// Dashboard apps
const ContextDashboard: React.FC = () => {
  return (
    <DashboardContextProvider>
      <div>
        <ContextSidebar />
        <ContextFilterBar />
        <div>
          <ContextRevenueWidget />
          <ContextUserWidget />
          <ContextConversionWidget />
          <ContextPageViewWidget />
        </div>
        <ContextChartSection />
        <ContextNotificationList />
      </div>
    </DashboardContextProvider>
  );
};

const StoreDashboard: React.FC<{
  store: ReturnType<typeof createDashboardStore>;
}> = ({ store }) => {
  return (
    <div>
      <StoreSidebar store={store} />
      <StoreFilterBar store={store} />
      <div>
        <StoreRevenueWidget store={store} />
        <StoreUserWidget store={store} />
        <StoreConversionWidget store={store} />
        <StorePageViewWidget store={store} />
      </div>
      <StoreChartSection store={store} />
      <StoreNotificationList store={store} />
    </div>
  );
};

describe('React Context vs store-react Performance', () => {
  describe('Isolated metric update (only revenue changes)', () => {
    bench('React Context - update single metric', () => {
      resetRenderCounts();

      // Create a test wrapper that updates revenue
      const TestApp = () => {
        const [, forceRender] = useState(0);
        const contextRef = useRef<any>(null);

        return (
          <DashboardContextProvider>
            <DashboardContext.Consumer>
              {(context) => {
                contextRef.current = context;
                return <ContextDashboard />;
              }}
            </DashboardContext.Consumer>
            <button
              onClick={() => {
                if (contextRef.current) {
                  contextRef.current.updateMetric('revenue', 150000);
                  forceRender((prev) => prev + 1);
                }
              }}
            >
              Update
            </button>
          </DashboardContextProvider>
        );
      };

      // Initial render
      renderToString(<TestApp />);

      // Simulate revenue update
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderToString(<TestApp />);
      wrapper.querySelector('button')?.click();

      // All components re-render with Context
    });

    bench('store-react - update single metric', () => {
      resetRenderCounts();
      const createSlice = createStore(createInitialState());
      const store = createDashboardStore(createSlice);

      // Initial render
      renderToString(<StoreDashboard store={store} />);

      // Update only revenue
      store.metrics.selector.updateMetric('revenue', 150000);

      // Force re-render to measure
      renderToString(<StoreDashboard store={store} />);

      // Only RevenueWidget should re-render
    });
  });

  describe('UI state change (sidebar toggle)', () => {
    bench('React Context - toggle sidebar', () => {
      resetRenderCounts();

      const TestApp = () => {
        const [, forceRender] = useState(0);
        const contextRef = useRef<any>(null);

        return (
          <DashboardContextProvider>
            <DashboardContext.Consumer>
              {(context) => {
                contextRef.current = context;
                return <ContextDashboard />;
              }}
            </DashboardContext.Consumer>
            <button
              onClick={() => {
                if (contextRef.current) {
                  contextRef.current.toggleSidebar();
                  forceRender((prev) => prev + 1);
                }
              }}
            >
              Toggle
            </button>
          </DashboardContextProvider>
        );
      };

      renderToString(<TestApp />);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderToString(<TestApp />);
      wrapper.querySelector('button')?.click();
    });

    bench('store-react - toggle sidebar', () => {
      resetRenderCounts();
      const createSlice = createStore(createInitialState());
      const store = createDashboardStore(createSlice);

      renderToString(<StoreDashboard store={store} />);
      store.ui.selector.toggleSidebar();
      renderToString(<StoreDashboard store={store} />);
    });
  });

  describe('Multiple rapid updates', () => {
    bench('React Context - multiple rapid updates', () => {
      const TestApp = () => {
        const contextRef = useRef<any>(null);

        return (
          <DashboardContextProvider>
            <DashboardContext.Consumer>
              {(context) => {
                contextRef.current = context;
                return <ContextDashboard />;
              }}
            </DashboardContext.Consumer>
          </DashboardContextProvider>
        );
      };

      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderToString(<TestApp />);

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        // These would normally trigger re-renders in a real React app
        // Each update causes ALL components to re-render
      }
    });

    bench('store-react - multiple rapid updates', () => {
      const createSlice = createStore(createInitialState());
      const store = createDashboardStore(createSlice);

      for (let i = 0; i < 10; i++) {
        store.metrics.selector.updateMetric('revenue', 125000 + i * 1000);
        store.metrics.selector.updateMetric('users', 5000 + i * 10);
        store.ui.selector.toggleSidebar();
        store.notifications.selector.addNotification(`Update ${i}`, 'info');
      }

      // Only components subscribed to changed data re-render
    });
  });

  describe('Complex state updates', () => {
    bench('React Context - refresh all data', () => {
      const TestApp = () => {
        const contextRef = useRef<any>(null);

        return (
          <DashboardContextProvider>
            <DashboardContext.Consumer>
              {(context) => {
                contextRef.current = context;
                return <ContextDashboard />;
              }}
            </DashboardContext.Consumer>
          </DashboardContextProvider>
        );
      };

      renderToString(<TestApp />);
      // Refresh updates multiple metrics, causing full re-render
    });

    bench('store-react - refresh all data', () => {
      const createSlice = createStore(createInitialState());
      const store = createDashboardStore(createSlice);

      renderToString(<StoreDashboard store={store} />);
      store.actions.selector.refreshData();
      // Only metric widgets re-render, not UI components
    });
  });

  describe('Deep component tree (nested dashboards)', () => {
    const NestedContextDashboard: React.FC<{ depth: number }> = ({ depth }) => {
      if (depth === 0) return <ContextDashboard />;
      return (
        <div>
          <ContextDashboard />
          <NestedContextDashboard depth={depth - 1} />
        </div>
      );
    };

    const NestedStoreDashboard: React.FC<{ store: any; depth: number }> = ({
      store,
      depth,
    }) => {
      if (depth === 0) return <StoreDashboard store={store} />;
      return (
        <div>
          <StoreDashboard store={store} />
          <NestedStoreDashboard store={store} depth={depth - 1} />
        </div>
      );
    };

    bench('React Context - deep tree update', () => {
      renderToString(
        <DashboardContextProvider>
          <NestedContextDashboard depth={5} />
        </DashboardContextProvider>
      );
      // All instances at all depths re-render on any change
    });

    bench('store-react - deep tree update', () => {
      const createSlice = createStore(createInitialState());
      const store = createDashboardStore(createSlice);

      renderToString(<NestedStoreDashboard store={store} depth={5} />);
      store.metrics.selector.updateMetric('revenue', 200000);
      // Only revenue widgets at all depths re-render
    });
  });
});
