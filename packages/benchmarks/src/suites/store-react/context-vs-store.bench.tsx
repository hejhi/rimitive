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
  useEffect,
} from 'react';
import { describe, bench, beforeEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { useStore, useStoreSelector, type StoreApi } from '@lattice/store/react';

// Dashboard state
type DashboardState = {
  metrics: {
    revenue: number;
    users: number;
    conversions: number;
    pageViews: number;
  };
  charts: {
    dataPoints: number[];
  };
  ui: {
    sidebarOpen: boolean;
    theme: 'light' | 'dark';
  };
  notifications: string[];
};

// Initial state
const createInitialState = (): DashboardState => ({
  metrics: {
    revenue: 125000,
    users: 5000,
    conversions: 250,
    pageViews: 50000,
  },
  charts: {
    dataPoints: Array.from({ length: 100 }, (_, i) => i * 100),
  },
  ui: {
    sidebarOpen: true,
    theme: 'light',
  },
  notifications: [],
});

// Global render tracking
let globalRenderCounts: Map<string, number> = new Map();

beforeEach(() => {
  globalRenderCounts = new Map();
});

// === REACT CONTEXT IMPLEMENTATION ===
type DashboardContextValue = {
  state: DashboardState;
  updateRevenue: (value: number) => void;
  toggleSidebar: () => void;
  addNotification: (msg: string) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DashboardState>(createInitialState);

  const updateRevenue = useCallback((value: number) => {
    setState(prev => ({
      ...prev,
      metrics: { ...prev.metrics, revenue: value },
    }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState(prev => ({
      ...prev,
      ui: { ...prev.ui, sidebarOpen: !prev.ui.sidebarOpen },
    }));
  }, []);

  const addNotification = useCallback((msg: string) => {
    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, msg],
    }));
  }, []);

  return (
    <DashboardContext.Provider value={{ state, updateRevenue, toggleSidebar, addNotification }}>
      {children}
    </DashboardContext.Provider>
  );
};

// Context components - track renders
const ContextRevenueWidget = memo(() => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  const context = useContext(DashboardContext);
  if (!context) return null;

  useEffect(() => {
    globalRenderCounts.set('ContextRevenueWidget', renderCount.current);
  });

  return <div data-testid="revenue">{context.state.metrics.revenue}</div>;
});

const ContextUserWidget = memo(() => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  const context = useContext(DashboardContext);
  if (!context) return null;

  useEffect(() => {
    globalRenderCounts.set('ContextUserWidget', renderCount.current);
  });

  return <div data-testid="users">{context.state.metrics.users}</div>;
});

const ContextSidebar = memo(() => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  const context = useContext(DashboardContext);
  if (!context) return null;

  useEffect(() => {
    globalRenderCounts.set('ContextSidebar', renderCount.current);
  });

  return <div data-testid="sidebar">{context.state.ui.sidebarOpen ? 'Open' : 'Closed'}</div>;
});

const ContextNotifications = memo(() => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  const context = useContext(DashboardContext);
  if (!context) return null;

  useEffect(() => {
    globalRenderCounts.set('ContextNotifications', renderCount.current);
  });

  return <div data-testid="notifications">{context.state.notifications.length}</div>;
});

// === STORE-REACT IMPLEMENTATION ===
type StoreState = DashboardState & {
  updateRevenue: (value: number) => void;
  toggleSidebar: () => void;
  addNotification: (msg: string) => void;
};

type StoreWithApi = StoreState & StoreApi<StoreState>;

// Store components - track renders
const StoreRevenueWidget = memo(({ store }: { store: StoreWithApi }) => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  const revenue = useStoreSelector(store, s => s.metrics.revenue);

  useEffect(() => {
    globalRenderCounts.set('StoreRevenueWidget', renderCount.current);
  });

  return <div data-testid="revenue">{revenue}</div>;
});

const StoreUserWidget = memo(({ store }: { store: StoreWithApi }) => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  const users = useStoreSelector(store, s => s.metrics.users);

  useEffect(() => {
    globalRenderCounts.set('StoreUserWidget', renderCount.current);
  });

  return <div data-testid="users">{users}</div>;
});

const StoreSidebar = memo(({ store }: { store: StoreWithApi }) => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  const isOpen = useStoreSelector(store, s => s.ui.sidebarOpen);

  useEffect(() => {
    globalRenderCounts.set('StoreSidebar', renderCount.current);
  });

  return <div data-testid="sidebar">{isOpen ? 'Open' : 'Closed'}</div>;
});

const StoreNotifications = memo(({ store }: { store: StoreWithApi }) => {
  const renderCount = useRef(0);
  renderCount.current++;
  
  const count = useStoreSelector(store, s => s.notifications.length);

  useEffect(() => {
    globalRenderCounts.set('StoreNotifications', renderCount.current);
  });

  return <div data-testid="notifications">{count}</div>;
});

// Test apps
const StoreApp = ({ store }: { store: StoreWithApi }) => (
  <>
    <StoreRevenueWidget store={store} />
    <StoreUserWidget store={store} />
    <StoreSidebar store={store} />
    <StoreNotifications store={store} />
  </>
);

describe('React Context vs store-react - Re-render Performance', () => {
  describe('Single property update', () => {
    bench('React Context - update revenue only', async () => {
      globalRenderCounts.clear();
      
      const UpdateButton = () => {
        const context = useContext(DashboardContext);
        return (
          <button onClick={() => context?.updateRevenue(150000)}>
            Update Revenue
          </button>
        );
      };

      const { getByText } = render(
        <DashboardProvider>
          <ContextRevenueWidget />
          <ContextUserWidget />
          <ContextSidebar />
          <ContextNotifications />
          <UpdateButton />
        </DashboardProvider>
      );

      // Initial render
      await waitFor(() => {
        expect(globalRenderCounts.get('ContextRevenueWidget')).toBe(1);
      });

      // Update revenue
      act(() => {
        getByText('Update Revenue').click();
      });

      // Wait for re-renders
      await waitFor(() => {
        // With Context, ALL components re-render
        expect(globalRenderCounts.get('ContextRevenueWidget')).toBe(2);
        expect(globalRenderCounts.get('ContextUserWidget')).toBe(2);
        expect(globalRenderCounts.get('ContextSidebar')).toBe(2);
        expect(globalRenderCounts.get('ContextNotifications')).toBe(2);
      });
    });

    bench('store-react - update revenue only', async () => {
      globalRenderCounts.clear();
      
      const createTestStore = () => useStore<StoreState>((set, get) => ({
        ...createInitialState(),
        updateRevenue: (value) => set({ 
          metrics: { ...get().metrics, revenue: value } 
        }),
        toggleSidebar: () => set({ 
          ui: { ...get().ui, sidebarOpen: !get().ui.sidebarOpen } 
        }),
        addNotification: (msg) => set({ 
          notifications: [...get().notifications, msg] 
        }),
      }));

      const TestWrapper = () => {
        const store = createTestStore();
        return (
          <>
            <StoreApp store={store} />
            <button onClick={() => store.updateRevenue(150000)}>
              Update Revenue
            </button>
          </>
        );
      };

      const { getByText } = render(<TestWrapper />);

      // Initial render
      await waitFor(() => {
        expect(globalRenderCounts.get('StoreRevenueWidget')).toBe(1);
      });

      // Update revenue
      act(() => {
        getByText('Update Revenue').click();
      });

      // Wait for re-renders
      await waitFor(() => {
        // With store-react, ONLY revenue widget re-renders
        expect(globalRenderCounts.get('StoreRevenueWidget')).toBe(2);
        expect(globalRenderCounts.get('StoreUserWidget')).toBe(1);
        expect(globalRenderCounts.get('StoreSidebar')).toBe(1);
        expect(globalRenderCounts.get('StoreNotifications')).toBe(1);
      });
    });
  });

  describe('Multiple rapid updates', () => {
    bench('React Context - 10 rapid updates', async () => {
      let updateFns: DashboardContextValue | null = null;

      const TestApp = () => {
        const context = useContext(DashboardContext);
        updateFns = context;
        return (
          <>
            <ContextRevenueWidget />
            <ContextUserWidget />
            <ContextSidebar />
            <ContextNotifications />
          </>
        );
      };

      render(
        <DashboardProvider>
          <TestApp />
        </DashboardProvider>
      );

      await waitFor(() => {
        expect(updateFns).not.toBeNull();
      });

      // Perform rapid updates
      act(() => {
        for (let i = 0; i < 10; i++) {
          updateFns!.updateRevenue(125000 + i * 1000);
          updateFns!.toggleSidebar();
          updateFns!.addNotification(`Update ${i}`);
        }
      });

      // Each update causes all components to re-render
    });

    bench('store-react - 10 rapid updates', async () => {
      let storeRef: StoreWithApi | null = null;

      const TestWrapper = () => {
        const store = useStore<StoreState>((set, get) => ({
          ...createInitialState(),
          updateRevenue: (value) => set({ 
            metrics: { ...get().metrics, revenue: value } 
          }),
          toggleSidebar: () => set({ 
            ui: { ...get().ui, sidebarOpen: !get().ui.sidebarOpen } 
          }),
          addNotification: (msg) => set({ 
            notifications: [...get().notifications, msg] 
          }),
        }));
        
        storeRef = store;
        return <StoreApp store={store} />;
      };

      render(<TestWrapper />);

      await waitFor(() => {
        expect(storeRef).not.toBeNull();
      });

      // Perform rapid updates
      act(() => {
        for (let i = 0; i < 10; i++) {
          storeRef!.updateRevenue(125000 + i * 1000);
          storeRef!.toggleSidebar();
          storeRef!.addNotification(`Update ${i}`);
        }
      });

      // Only affected components re-render for their specific changes
    });
  });

  describe('Large component tree (100 widgets)', () => {
    bench('React Context - update with 100 components', async () => {
      const ManyWidgets = () => {
        const context = useContext(DashboardContext);
        if (!context) return null;

        return (
          <>
            {Array.from({ length: 100 }, (_, i) => (
              <div key={i}>{context.state.metrics.revenue}</div>
            ))}
          </>
        );
      };

      const TestApp = () => {
        const context = useContext(DashboardContext);
        return (
          <>
            <ManyWidgets />
            <button onClick={() => context?.updateRevenue(200000)}>
              Update
            </button>
          </>
        );
      };

      const { getByText } = render(
        <DashboardProvider>
          <TestApp />
        </DashboardProvider>
      );

      act(() => {
        getByText('Update').click();
      });

      // All 100 components re-render
    });

    bench('store-react - update with 100 components', async () => {
      const ManyWidgets = ({ store }: { store: StoreWithApi }) => {
        const revenue = useStoreSelector(store, s => s.metrics.revenue);

        return (
          <>
            {Array.from({ length: 100 }, (_, i) => (
              <div key={i}>{revenue}</div>
            ))}
          </>
        );
      };

      const TestWrapper = () => {
        const store = useStore<StoreState>((set, get) => ({
          ...createInitialState(),
          updateRevenue: (value) => set({ 
            metrics: { ...get().metrics, revenue: value } 
          }),
          toggleSidebar: () => set({ 
            ui: { ...get().ui, sidebarOpen: !get().ui.sidebarOpen } 
          }),
          addNotification: (msg) => set({ 
            notifications: [...get().notifications, msg] 
          }),
        }));

        return (
          <>
            <ManyWidgets store={store} />
            <button onClick={() => store.updateRevenue(200000)}>
              Update
            </button>
          </>
        );
      };

      const { getByText } = render(<TestWrapper />);

      act(() => {
        getByText('Update').click();
      });

      // Only revenue subscribers re-render
    });
  });
});