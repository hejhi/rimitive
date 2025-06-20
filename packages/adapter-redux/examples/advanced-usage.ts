/**
 * Redux Adapter Advanced Usage Guide
 * 
 * This guide shows advanced patterns with the Redux adapter and two-phase reactive API
 */

import { configureStore, createSlice as createReduxSlice } from '@reduxjs/toolkit';
import { latticeReducer, reduxAdapter } from '@lattice/adapter-redux';
import type { RuntimeSliceFactory } from '@lattice/core';

interface AppState {
  count: number;
  user: {
    name: string;
    loggedIn: boolean;
  };
}

// ============================================
// BASIC USAGE
// ============================================

export function basicUsage() {
  // You create your own Redux store
  const store = configureStore({
    reducer: latticeReducer.reducer,
    preloadedState: {
      count: 0,
      user: { name: '', loggedIn: false }
    }
  });
  
  // Then wrap it with the adapter
  const createSlice = reduxAdapter<AppState>(store);
  
  const counter = createSlice(
    (selectors) => ({ count: selectors.count }),
    ({ count }, set) => ({
      value: () => count(),
      increment: () => set(
        (selectors) => ({ count: selectors.count }),
        ({ count }) => ({ count: count() + 1 })
      )
    })
  );
  
  return { store, counter };
}

// ============================================
// WITH MIDDLEWARE
// ============================================

export function withMiddleware() {
  // You have full control over middleware
  const store = configureStore({
    reducer: latticeReducer.reducer,
    preloadedState: {
      count: 0,
      user: { name: '', loggedIn: false }
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types
          ignoredActions: ['persist/PERSIST']
        }
      }),
    // Control DevTools
    devTools: {
      name: 'My App',
      trace: true,
      traceLimit: 25
    }
  });
  
  const createSlice = reduxAdapter<AppState>(store);
  
  return { store, createSlice };
}

// ============================================
// WITH MULTIPLE SLICES
// ============================================

export function withMultipleSlices() {
  // You might have existing Redux slices
  const authSlice = createReduxSlice({
    name: 'auth',
    initialState: { token: null },
    reducers: {
      setToken: (state, action) => {
        state.token = action.payload;
      }
    }
  });
  
  // Combine them with Lattice
  const store = configureStore({
    reducer: {
      // Lattice manages this part
      app: latticeReducer.reducer,
      // Your existing Redux slices
      auth: authSlice.reducer
    },
    preloadedState: {
      app: {
        count: 0,
        user: { name: '', loggedIn: false }
      }
    }
  });
  
  // Tell the adapter to use the 'app' slice
  const createSlice = reduxAdapter<AppState>(store, { slice: 'app' });
  
  // Now you can use both Lattice and Redux patterns
  return { 
    store, 
    createSlice,
    // You can still dispatch Redux actions
    setToken: (token: string) => store.dispatch(authSlice.actions.setToken(token))
  };
}

// ============================================
// KEY BENEFITS
// ============================================

/**
 * 1. Full control over Redux configuration
 * 2. Easy integration with Redux ecosystem
 * 3. Clean separation of concerns
 * 4. Combine with existing Redux code
 * 5. Access to all Redux middleware and enhancers
 * 6. Type-safe and explicit
 */