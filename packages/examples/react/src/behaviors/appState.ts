import type { SignalsApi, Signal } from './types';

export interface AppStateState {
  userName: Signal<string>;
  userEmail: Signal<string>;
  theme: Signal<'light' | 'dark'>;
  clickCount: Signal<number>;

  // Actions
  setUserName: (name: string) => void;
  setUserEmail: (email: string) => void;
  toggleTheme: () => void;
  incrementClicks: () => void;
}

export const appState = (api: SignalsApi) => (): AppStateState => {
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
