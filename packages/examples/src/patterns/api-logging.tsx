/**
 * @fileoverview API Parameter - Logging & Debugging Example
 *
 * This example demonstrates how to use the API parameter for comprehensive
 * logging, debugging, and observability in your Lattice applications.
 */

import { createModel, createSlice } from '@lattice/core';
import { createZustandAdapter } from '@lattice/adapter-zustand';
import { useViews } from '@lattice/runtime/react';

// ============================================================================
// Logging Utilities
// ============================================================================
interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  source: string;
}

const logStore: LogEntry[] = [];

function createLogger(source: string) {
  return {
    debug: (message: string, data?: unknown) => {
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: 'debug',
        message,
        data,
        source,
      };
      logStore.push(entry);
      console.log(`[${source}] ${message}`, data);
    },
    info: (message: string, data?: unknown) => {
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: 'info',
        message,
        data,
        source,
      };
      logStore.push(entry);
      console.info(`[${source}] ${message}`, data);
    },
    warn: (message: string, data?: unknown) => {
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: 'warn',
        message,
        data,
        source,
      };
      logStore.push(entry);
      console.warn(`[${source}] ${message}`, data);
    },
    error: (message: string, data?: unknown) => {
      const entry: LogEntry = {
        timestamp: Date.now(),
        level: 'error',
        message,
        data,
        source,
      };
      logStore.push(entry);
      console.error(`[${source}] ${message}`, data);
    },
  };
}

// ============================================================================
// Debugging Component with Comprehensive Logging
// ============================================================================
export const debuggingComponent = () => {
  const logger = createLogger('DebugApp');

  const model = createModel<{
    // State
    user: { id: string; name: string } | null;
    notifications: Array<{ id: string; message: string; read: boolean }>;
    settings: { theme: 'light' | 'dark'; notifications: boolean };

    // Actions
    login: (username: string) => void;
    logout: () => void;
    markNotificationRead: (id: string) => void;
    updateSettings: (
      updates: Partial<{ theme: 'light' | 'dark'; notifications: boolean }>
    ) => void;

    // Debug state
    debugMode: boolean;
    toggleDebugMode: () => void;
  }>(({ set, get }) => ({
    // Initial state
    user: null,
    notifications: [],
    settings: { theme: 'light', notifications: true },
    debugMode: false,

    // Actions
    login: (username) => {
      logger.info('Login attempt', { username });
      const user = { id: `user-${Date.now()}`, name: username };
      set({
        user,
        notifications: [
          { id: '1', message: `Welcome back, ${username}!`, read: false },
          { id: '2', message: 'Check out new features', read: false },
        ],
      });
      logger.info('Login successful', { userId: user.id });
    },

    logout: () => {
      const currentUser = get().user;
      logger.info('Logout', { userId: currentUser?.id });
      set({ user: null, notifications: [] });
    },

    markNotificationRead: (id) => {
      logger.debug('Marking notification as read', { id });
      set({
        notifications: get().notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      });
    },

    updateSettings: (updates) => {
      const oldSettings = get().settings;
      logger.info('Settings update', { old: oldSettings, updates });
      set({ settings: { ...oldSettings, ...updates } });
    },

    toggleDebugMode: () => {
      const newMode = !get().debugMode;
      logger[newMode ? 'warn' : 'info']('Debug mode toggled', {
        enabled: newMode,
      });
      set({ debugMode: newMode });
    },
  }));

  // Actions slice with logging
  const actions = createSlice(model, (m) => ({
    login: (username: string) => {
      m.login(username);
    },

    logout: () => {
      m.logout();
    },

    markNotificationRead: m.markNotificationRead,
    updateSettings: m.updateSettings,
    toggleDebugMode: m.toggleDebugMode,
  }));

  // State slice with debugging info
  const stateSlice = createSlice(model, (m) => {
    const baseState = {
      user: m.user,
      notifications: m.notifications,
      settings: m.settings,
      debugMode: m.debugMode,
    };

    return baseState;
  });

  // Notification views with performance tracking
  const notificationViews = createSlice(model, (m) => {
    const startTime = performance.now();

    const unreadNotifications = m.notifications.filter((n) => !n.read);
    const readNotifications = m.notifications.filter((n) => n.read);

    if (m.debugMode) {
      const endTime = performance.now();
      logger.debug('Notification filtering', {
        duration: `${(endTime - startTime).toFixed(2)}ms`,
        totalCount: m.notifications.length,
        unreadCount: unreadNotifications.length,
        readCount: readNotifications.length,
      });
    }

    return {
      unread: unreadNotifications,
      read: readNotifications,
      hasUnread: unreadNotifications.length > 0,
      unreadCount: unreadNotifications.length,
    };
  });

  // Settings view with change detection
  const settingsView = createSlice(model, (m) => ({
    ...m.settings,

    // Helper to update with logging
    updateWithLogging: (updates: Partial<typeof m.settings>) => {
      actions(m).updateSettings(updates);
    },
  }));

  // Debug panel view
  const debugView = createSlice(model, (m) => {
    if (!m.debugMode) return null;

    const logs = logStore.slice(-20); // Last 20 log entries

    return {
      logs,
      stats: {
        totalLogs: logStore.length,
        errorCount: logStore.filter((l) => l.level === 'error').length,
        warnCount: logStore.filter((l) => l.level === 'warn').length,
      },
    };
  });

  return {
    model,
    actions,
    views: {
      state: stateSlice,
      notifications: notificationViews,
      settings: settingsView,
      debug: debugView,
    },
  };
};

// ============================================================================
// Create Store
// ============================================================================
const debugStore = createZustandAdapter(debuggingComponent);

// ============================================================================
// React Components
// ============================================================================
declare const globalThis: {
  __debugRenderCount?: number;
};

function DebugPanel() {
  const debug = useViews(debugStore, (views) => views.debug());

  if (!debug) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: '400px',
        maxHeight: '300px',
        background: '#f0f0f0',
        border: '1px solid #ccc',
        padding: '10px',
        fontSize: '12px',
        overflow: 'auto',
      }}
    >
      <h4>Debug Panel</h4>

      <details>
        <summary>
          Stats (Total: {debug.stats.totalLogs}, Errors:{' '}
          {debug.stats.errorCount}, Warnings: {debug.stats.warnCount})
        </summary>
        <div style={{ maxHeight: '150px', overflow: 'auto' }}>
          {debug.logs.map((log, i) => (
            <div
              key={i}
              style={{
                padding: '2px 4px',
                color:
                  log.level === 'error'
                    ? 'red'
                    : log.level === 'warn'
                      ? 'orange'
                      : 'inherit',
              }}
            >
              [{new Date(log.timestamp).toLocaleTimeString()}]{' '}
              {log.level.toUpperCase()}: {log.message}
              {log.data !== undefined && (
                <pre style={{ margin: 0, fontSize: '10px' }}>
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function NotificationList() {
  const { notifications, actions } = useViews(debugStore, (views) => ({
    notifications: views.notifications(),
    actions: views.state().debugMode
      ? {
          markRead: (id: string) => {
            console.log('[UI] Marking notification as read:', id);
            return views.notifications().unread.find((n) => n.id === id);
          },
        }
      : null,
  }));

  const storeActions = debugStore.actions;

  return (
    <div>
      <h3>Notifications ({notifications.unreadCount} unread)</h3>

      {notifications.unread.length > 0 && (
        <div>
          <h4>Unread</h4>
          {notifications.unread.map((n) => (
            <div key={n.id} style={{ padding: '5px', background: '#fffacd' }}>
              {n.message}
              <button
                onClick={() => {
                  if (actions?.markRead) {
                    const notification = actions.markRead(n.id);
                    console.log('[UI] Found notification:', notification);
                  }
                  storeActions.markNotificationRead(n.id);
                }}
              >
                Mark Read
              </button>
            </div>
          ))}
        </div>
      )}

      {notifications.read.length > 0 && (
        <div>
          <h4>Read</h4>
          {notifications.read.map((n) => (
            <div key={n.id} style={{ padding: '5px', opacity: 0.6 }}>
              {n.message} ✓
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DebuggingExample() {
  const { state, settings } = useViews(debugStore, (views) => ({
    state: views.state(),
    settings: views.settings(),
  }));
  const actions = debugStore.actions;

  return (
    <div style={{ padding: '20px' }}>
      <h1>API Logging & Debugging Example</h1>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="checkbox"
            checked={state.debugMode}
            onChange={() => actions.toggleDebugMode()}
          />
          Enable Debug Mode
        </label>
      </div>

      {!state.user ? (
        <div>
          <h2>Login</h2>
          <button onClick={() => actions.login('TestUser')}>
            Login as TestUser
          </button>
        </div>
      ) : (
        <div>
          <h2>Welcome, {state.user.name}!</h2>
          <button onClick={() => actions.logout()}>Logout</button>

          <NotificationList />

          <div style={{ marginTop: '20px' }}>
            <h3>Settings</h3>
            <label>
              Theme:
              <select
                value={settings.theme}
                onChange={(e) =>
                  settings.updateWithLogging({
                    theme: e.target.value as 'light' | 'dark',
                  })
                }
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <label style={{ marginLeft: '10px' }}>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) =>
                  settings.updateWithLogging({
                    notifications: e.target.checked,
                  })
                }
              />
              Enable Notifications
            </label>
          </div>
        </div>
      )}

      {state.debugMode && <DebugPanel />}
    </div>
  );
}
