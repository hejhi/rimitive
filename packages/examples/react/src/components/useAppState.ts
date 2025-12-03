/**
 * App State Behavior - Demonstrates Fine-Grained Reactivity
 *
 * Manages multiple pieces of state to show that only components
 * subscribed to specific signals will re-render when those signals change.
 */
import type { Service } from '../service';

export const useAppState = (api: Service) => {
  const userName = api.signal('Alice');
  const userEmail = api.signal('alice@example.com');
  const theme = api.signal<'light' | 'dark'>('light');
  const clickCount = api.signal(0);

  return {
    // Reactive state
    userName,
    userEmail,
    theme,
    clickCount,

    // Actions
    setUserName: (name: string) => userName(name),
    setUserEmail: (email: string) => userEmail(email),
    toggleTheme: () => theme(theme() === 'light' ? 'dark' : 'light'),
    incrementClicks: () => clickCount(clickCount() + 1),
  };
};
