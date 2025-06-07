/**
 * @fileoverview Single source of truth for all app behavior specifications
 *
 * This file demonstrates how you can define all your application's behavior
 * in one place, completely independent of any state management library or
 * UI framework. These specifications can then be used with any adapter.
 */

import { createModel, createSlice, compose } from '@lattice/core';

// ============================================================================
// Shared User Component
// ============================================================================
export const userComponent = () => {
  const model = createModel<{
    user: { id: string; name: string; email: string } | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    updateProfile: (updates: { name?: string; email?: string }) => void;
  }>(({ set, get }) => ({
    user: null,
    isLoading: false,
    error: null,

    login: async (email, _password) => {
      set({ isLoading: true, error: null });
      try {
        // Simulate API call
        const user = { id: '1', name: 'John Doe', email };
        set({ user, isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Login failed',
          isLoading: false,
        });
      }
    },

    logout: () => set({ user: null }),

    updateProfile: (updates) => {
      const current = get().user;
      if (current) {
        set({ user: { ...current, ...updates } });
      }
    },
  }));

  const actions = createSlice(model, (m) => ({
    login: m().login,
    logout: m().logout,
    updateProfile: m().updateProfile,
  }))

  createSlice(model, (m) => ({
    user: m().user,
    isLoggedIn: m().user !== null,
    isLoading: m().isLoading,
    error: m().error,
  }));

  return {
    model,
    actions,
    views: {
      loginButton: createSlice(model, (m) => ({
        onClick: async () => {
          // Example: Log login attempts
          console.log('[User] Login attempt for:', m().user?.email || 'unknown');
          await m().login('user@example.com', 'password');
        },
        disabled: m().isLoading,
        children: m().isLoading ? 'Logging in...' : 'Login',
      })),

      userProfile: createSlice(model, (m) => ({
        // Example: Use API to access additional context
        'data-last-update': new Date().toISOString(),
        className: m().user !== null ? 'profile-active' : 'profile-inactive',
        'data-user-id': m().user?.id || '',
        children: m().user ? `Welcome, ${m().user.name}` : 'Not logged in',
      })),
    },
  };
};

// ============================================================================
// Shopping Cart Component
// ============================================================================
export const cartComponent = () => {
  const model = createModel<{
    items: Array<{ id: string; name: string; price: number; quantity: number }>;
    addItem: (item: { id: string; name: string; price: number }) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clear: () => void;
  }>(({ set, get }) => ({
    items: [],

    addItem: (item) => {
      const items = get().items;
      const existing = items.find((i) => i.id === item.id);

      if (existing) {
        set({
          items: items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        });
      } else {
        set({ items: [...items, { ...item, quantity: 1 }] });
      }
    },

    removeItem: (id) => {
      set({ items: get().items.filter((item) => item.id !== id) });
    },

    updateQuantity: (id, quantity) => {
      if (quantity <= 0) {
        get().removeItem(id);
      } else {
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        });
      }
    },

    clear: () => set({ items: [] }),
  }));

  const actions = createSlice(model, (m) => ({
    addItem: m().addItem,
    removeItem: m().removeItem,
    updateQuantity: m().updateQuantity,
    clear: m().clear,
  }));

  const cartSlice = createSlice(model, (m) => ({
    items: m().items,
    itemCount: m().items.reduce((sum, item) => sum + item.quantity, 0),
    total: m().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }));

  // Computed view for cart summary with API
  const cartSummary = createSlice(model, (m) => {
    // Example: Use API to access computed values
    const data = cartSlice(m);

    return {
      className: data.itemCount === 0 ? 'cart-empty' : 'cart-has-items',
      'data-item-count': data.itemCount,
      'aria-label': `Cart with ${data.itemCount} items`,
      children: `${data.itemCount} items - $${data.total.toFixed(2)}`,
    };
  });

  return {
    model,
    actions,
    views: {
      cartSummary,

      // Note: Computed views can accept parameters and return either
      // data directly or a SliceFactory that will be executed
    },
  };
};

// ============================================================================
// Theme Component (UI Settings)
// ============================================================================
export const themeComponent = () => {
  const model = createModel<{
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    reducedMotion: boolean;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setFontSize: (size: 'small' | 'medium' | 'large') => void;
    toggleReducedMotion: () => void;
  }>(({ set, get }) => ({
    theme: 'system',
    fontSize: 'medium',
    reducedMotion: false,

    setTheme: (theme) => set({ theme }),
    setFontSize: (fontSize) => set({ fontSize }),
    toggleReducedMotion: () => set({ reducedMotion: !get().reducedMotion }),
  }));

  const actions = createSlice(model, (m) => ({
    setTheme: m().setTheme,
    setFontSize: m().setFontSize,
    toggleReducedMotion: m().toggleReducedMotion,
  }));

  createSlice(model, (m) => ({
    theme: m().theme,
    fontSize: m().fontSize,
    reducedMotion: m().reducedMotion,
  }));

  return {
    model,
    actions,
    views: {
      themeToggle: createSlice(model, (m) => ({
        // Example: Use API to log theme changes
        onThemeChange: (theme: 'light' | 'dark' | 'system') => {
          const oldTheme = m().theme;
          console.log(`[Theme] Changing from ${oldTheme} to ${theme}`);
          m().setTheme(theme);
        },
        currentTheme: m().theme,
        'aria-pressed': m().theme === 'dark',
        className: `theme-${m().theme}`,
      })),

      documentRoot: createSlice(model, (m) => ({
        className: [
          `theme-${m().theme}`,
          `font-${m().fontSize}`,
          m().reducedMotion ? 'reduced-motion' : '',
        ]
          .filter(Boolean)
          .join(' '),
        'data-theme': m().theme,
        'data-font-size': m().fontSize,
      })),
    },
  };
};

// ============================================================================
// Composite Dashboard Component
// ============================================================================
export const dashboardComponent = () => {
  // Compose behaviors from other components
  const user = userComponent();
  const cart = cartComponent();
  const theme = themeComponent();

  // Create a unified model that combines all three
  const model = createModel<{
    // Include all sub-models separately
    user: { id: string; name: string; email: string } | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    updateProfile: (updates: { name?: string; email?: string }) => void;
    items: Array<{ id: string; name: string; price: number; quantity: number }>;
    addItem: (item: { id: string; name: string; price: number }) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clear: () => void;
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    reducedMotion: boolean;
    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setFontSize: (size: 'small' | 'medium' | 'large') => void;
    toggleReducedMotion: () => void;
    // Add dashboard-specific state
    sidebarOpen: boolean;
    activeTab: 'overview' | 'orders' | 'settings';
    toggleSidebar: () => void;
    setActiveTab: (tab: 'overview' | 'orders' | 'settings') => void;
  }>(({ set, get }) => ({
    // User state
    ...user.model({ set, get }),
    // Cart state
    ...cart.model({ set, get }),
    // Theme state
    ...theme.model({ set, get }),
    sidebarOpen: true,
    activeTab: 'overview',

    toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
    setActiveTab: (tab) => set({ activeTab: tab }),
  }));

  // Compose slices from different components
  const dashboardSlice = createSlice(
    model,
    compose(
      {
        userSlice: createSlice(model, (m) => ({
          user: m().user,
          isLoading: m().isLoading,
          error: m().error,
        })),
        cartSlice: createSlice(model, (m) => ({ items: m().items })),
        themeSlice: createSlice(model, (m) => ({
          theme: m().theme,
          fontSize: m().fontSize,
          reducedMotion: m().reducedMotion,
        })),
      },
      (m, { userSlice, cartSlice, themeSlice }) => ({
        // Example: Use API for cross-component data access
        isLoggedIn: userSlice.user !== null,
        userName: userSlice.user?.name || 'Guest',
        cartItemCount: cartSlice.items.length,
        currentTheme: themeSlice.theme,
        sidebarOpen: m().sidebarOpen,
        activeTab: m().activeTab,
      })
    )
  );

  return {
    model,
    actions: createSlice(model, (m) => ({
      // User actions
      login: m().login,
      logout: m().logout,
      // Cart actions
      addToCart: m().addItem,
      clearCart: m().clear,
      // Theme actions
      setTheme: m().setTheme,
      // Dashboard actions
      toggleSidebar: m().toggleSidebar,
      setActiveTab: m().setActiveTab,
    })),
    views: {
      header: createSlice(model, (m) => {
        const dashboardData = dashboardSlice(m);
        return {
          // Example: Use API to include real-time data
          className: `header ${dashboardData.currentTheme}`,
          'data-sidebar-open': dashboardData.sidebarOpen,
          children: `${dashboardData.userName} - ${dashboardData.cartItemCount} items in cart`,
        };
      }),

      navigation: createSlice(model, (m) => ({
        // Example: Use API to track navigation events
        tabs: (['overview', 'orders', 'settings'] as const).map((tab) => ({
          name: tab,
          active: m().activeTab === tab,
          onClick: () => m().setActiveTab(tab),
        })),
      })),
    },
  };
};
