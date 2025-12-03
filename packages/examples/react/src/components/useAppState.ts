/**
 * useAppState - Portable App State Behavior
 *
 * Manages multiple pieces of state to demonstrate fine-grained reactivity.
 * Framework-agnostic - works with any signals implementation.
 *
 * @example
 * ```ts
 * // With Lattice signals
 * const appState = useAppState({ signal, computed, effect })();
 *
 * // With React (via createHook)
 * const useAppStateHook = createHook(useAppState);
 * const appState = useAppStateHook();
 * ```
 */
import type { SignalsApi, Signal } from './types';

export interface AppStateState {
  /** User's display name */
  userName: Signal<string>;
  /** User's email address */
  userEmail: Signal<string>;
  /** Current theme */
  theme: Signal<'light' | 'dark'>;
  /** Click counter */
  clickCount: Signal<number>;

  /** Update user name */
  setUserName: (name: string) => void;
  /** Update user email */
  setUserEmail: (email: string) => void;
  /** Toggle between light and dark theme */
  toggleTheme: () => void;
  /** Increment click counter */
  incrementClicks: () => void;
}

/**
 * Creates a portable app state behavior
 *
 * @param api - Signals API (signal, computed, effect)
 * @returns Factory function that creates app state
 */
export const useAppState =
  (api: SignalsApi) =>
  (): AppStateState => {
    const { signal } = api;

    const userName = signal('Alice');
    const userEmail = signal('alice@example.com');
    const theme = signal<'light' | 'dark'>('light');
    const clickCount = signal(0);

    return {
      userName,
      userEmail,
      theme,
      clickCount,

      setUserName: (name: string) => userName(name),
      setUserEmail: (email: string) => userEmail(email),
      toggleTheme: () => theme(theme() === 'light' ? 'dark' : 'light'),
      incrementClicks: () => clickCount(clickCount() + 1),
    };
  };
