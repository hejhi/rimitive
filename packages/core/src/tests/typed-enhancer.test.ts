/**
 * Example of using the LatticeEnhancer type for better type safety
 */
import { describe, expect, it } from 'vitest';
import { createLattice } from '../createLattice';
import { createAPI } from '../createAPI';
import { withLattice } from '../withLattice';
import { LatticeEnhancer } from '../types';

describe('Typed Lattice Enhancers', () => {
  it('should support strongly typed feature enhancers', () => {
    // Base lattice with user state
    interface UserState {
      username: string;
      setUsername: (name: string) => void;
    }

    const { api: userAPI } = createAPI<UserState>((set) => ({
      username: 'guest',
      setUsername: (name) => set({ username: name }),
    }));

    const userLattice = createLattice<UserState>('user', { api: userAPI });

    // Theme feature enhancer
    interface ThemeState {
      isDarkMode: boolean;
      toggleTheme: () => void;
    }

    // Use the LatticeEnhancer type for better type safety
    const createThemeFeature = (): LatticeEnhancer<UserState, ThemeState> => {
      return (baseLattice) => {
        const { api: themeAPI } = createAPI<ThemeState>((set) => ({
          isDarkMode: false,
          toggleTheme: () =>
            set((state) => ({ isDarkMode: !state.isDarkMode })),
        }));

        // The return type is automatically inferred as Lattice<UserState & ThemeState>
        return createLattice(
          'theme',
          withLattice(baseLattice)({
            api: themeAPI,
          })
        );
      };
    };

    // Auth feature enhancer that builds on user and theme
    interface AuthState {
      isLoggedIn: boolean;
      login: (password: string) => boolean;
      logout: () => void;
    }

    // Use LatticeEnhancer with the combined state from user and theme
    const createAuthFeature = (): LatticeEnhancer<
      UserState & ThemeState,
      AuthState
    > => {
      return (baseLattice) => {
        const { api: authAPI } = createAPI<AuthState>((set) => ({
          isLoggedIn: false,
          login: (password) => {
            // We can access user state from the base lattice if needed
            // Using a simpler authentication approach for the example
            if (password === 'secret') {
              set({ isLoggedIn: true });
              return true;
            }
            return false;
          },
          logout: () => set({ isLoggedIn: false }),
        }));

        return createLattice(
          'auth',
          withLattice(baseLattice)({
            api: authAPI,
          })
        );
      };
    };

    // Apply the enhancers in sequence with full type safety
    const themeFeature = createThemeFeature();
    const authFeature = createAuthFeature();

    const enhancedLattice = userLattice.use(themeFeature).use(authFeature);

    // TypeScript now knows the combined type is UserState & ThemeState & AuthState
    const state = enhancedLattice.api.getState();

    // All properties and methods are strongly typed
    expect(state).toHaveProperty('username');
    expect(state).toHaveProperty('isDarkMode');
    expect(state).toHaveProperty('isLoggedIn');
    expect(state).toHaveProperty('toggleTheme');
    expect(state).toHaveProperty('login');
  });
});
