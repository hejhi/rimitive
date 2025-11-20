/**
 * App State Component - Demonstrates Fine-Grained Reactivity
 *
 * This component manages multiple pieces of state.
 * Unlike React Context, only components subscribed to specific
 * signals will re-render when those signals change.
 */

import type { SignalFunction } from '@lattice/signals/signal';

export interface UseAppState {
  // User state
  userName: SignalFunction<string>;
  userEmail: SignalFunction<string>;
  setUserName: (name: string) => void;
  setUserEmail: (email: string) => void;

  // Theme state
  theme: SignalFunction<'light' | 'dark'>;
  toggleTheme: () => void;

  // Counter state
  clickCount: SignalFunction<number>;
  incrementClicks: () => void;
}

export function useAppState(api: {
  signal: <T>(value: T) => SignalFunction<T>;
}): UseAppState {
  const userName = api.signal('Alice');
  const userEmail = api.signal('alice@example.com');
  const theme = api.signal<'light' | 'dark'>('light');
  const clickCount = api.signal(0);

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
}
