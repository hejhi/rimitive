import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createModel } from '../model';
import { withStoreSubscribe } from '../state';

describe('Action Composition', () => {
  it('composes actions from multiple sources', () => {
    // Create two separate state stores
    const counterStore = create(() => ({ count: 0 }));
    const userStore = create(() => ({ name: 'Guest', isAuthenticated: false }));

    // Create subscribers
    const counterSubscriber = withStoreSubscribe(counterStore, (state) => ({
      count: state.count,
    }));

    const userSubscriber = withStoreSubscribe(userStore, (state) => ({
      name: state.name,
      isAuthenticated: state.isAuthenticated,
    }));

    // Create counter model
    const { model: counterModel } = createModel(counterSubscriber)(
      (_set, _get, selectedState) => ({
        getCount: () => selectedState.count,
        increment: () =>
          counterStore.setState((state) => ({ count: state.count + 1 })),
        decrement: () =>
          counterStore.setState((state) => ({ count: state.count - 1 })),
        reset: () => counterStore.setState({ count: 0 }),
      })
    );

    // Create user model
    const { model: userModel } = createModel(userSubscriber)(
      (_set, _get, selectedState) => ({
        getName: () => selectedState.name,
        isAuthenticated: () => selectedState.isAuthenticated,
        login: (name: string) =>
          userStore.setState({ name, isAuthenticated: true }),
        logout: () =>
          userStore.setState({ name: 'Guest', isAuthenticated: false }),
      })
    );

    // Spy on model methods
    const incrementSpy = vi.spyOn(counterModel, 'increment');
    const loginSpy = vi.spyOn(userModel, 'login');
    const logoutSpy = vi.spyOn(userModel, 'logout');

    // Create separate action objects
    const counterActions = {
      increment: () => counterModel.increment(),
      decrement: () => counterModel.decrement(),
      reset: () => counterModel.reset(),
    };

    const userActions = {
      login: (name: string) => userModel.login(name),
      logout: () => userModel.logout(),
    };

    // Create a composed actions object that includes actions from both sources
    const composedActions = {
      ...counterActions,
      ...userActions,
      // Add new composed actions that use multiple models
      incrementIfAuthenticated: () => {
        if (userModel.isAuthenticated()) {
          counterModel.increment();
          return true;
        }
        return false;
      },
      loginAndReset: (name: string) => {
        userModel.login(name);
        counterModel.reset();
      },
    };

    // Test initial state
    expect(counterModel.getCount()).toBe(0);
    expect(userModel.getName()).toBe('Guest');
    expect(userModel.isAuthenticated()).toBe(false);

    // Test authentication-conditional increment
    expect(composedActions.incrementIfAuthenticated()).toBe(false);
    expect(incrementSpy).not.toHaveBeenCalled();
    expect(counterModel.getCount()).toBe(0);

    // Test login and verify authentication state
    composedActions.login('Alice');
    expect(loginSpy).toHaveBeenCalledWith('Alice');
    expect(userModel.getName()).toBe('Alice');
    expect(userModel.isAuthenticated()).toBe(true);

    // Test conditional increment now that user is authenticated
    expect(composedActions.incrementIfAuthenticated()).toBe(true);
    expect(incrementSpy).toHaveBeenCalledTimes(1);
    expect(counterModel.getCount()).toBe(1);

    // Test composed loginAndReset action
    composedActions.loginAndReset('Bob');
    expect(loginSpy).toHaveBeenCalledWith('Bob');
    expect(userModel.getName()).toBe('Bob');
    expect(counterModel.getCount()).toBe(0);

    // Test logout and increment
    composedActions.logout();
    expect(logoutSpy).toHaveBeenCalled();
    expect(userModel.isAuthenticated()).toBe(false);

    composedActions.increment();
    expect(incrementSpy).toHaveBeenCalledTimes(2);
    expect(counterModel.getCount()).toBe(1);
  });

  it('composes actions with different scopes and namespaces', () => {
    // Create stores for different feature areas
    const navigationStore = create(() => ({
      currentPage: 'home',
      breadcrumbs: ['home'],
    }));

    const themingStore = create(() => ({
      theme: 'light',
      fontSize: 'medium',
    }));

    // Create subscribers
    const navigationSubscriber = withStoreSubscribe(
      navigationStore,
      (state) => state
    );
    const themingSubscriber = withStoreSubscribe(
      themingStore,
      (state) => state
    );

    // Create navigation model
    const { model: navigationModel } = createModel(navigationSubscriber)(
      (_set, _get, selectedState) => ({
        getCurrentPage: () => selectedState.currentPage,
        getBreadcrumbs: () => selectedState.breadcrumbs,

        navigate: (page: string) => {
          navigationStore.setState({
            currentPage: page,
            breadcrumbs: [...selectedState.breadcrumbs, page],
          });
        },

        goHome: () => {
          navigationStore.setState({
            currentPage: 'home',
            breadcrumbs: ['home'],
          });
        },
      })
    );

    // Create theming model
    const { model: themingModel } = createModel(themingSubscriber)(
      (_set, _get, selectedState) => ({
        getTheme: () => selectedState.theme,
        getFontSize: () => selectedState.fontSize,

        setTheme: (theme: string) => {
          themingStore.setState({ theme });
        },

        setFontSize: (fontSize: string) => {
          themingStore.setState({ fontSize });
        },

        toggleTheme: () => {
          themingStore.setState({
            theme: selectedState.theme === 'light' ? 'dark' : 'light',
          });
        },
      })
    );

    // Spy on model methods
    const navigateSpy = vi.spyOn(navigationModel, 'navigate');
    const setThemeSpy = vi.spyOn(themingModel, 'setTheme');

    // Create namespaced actions
    const actions = {
      navigation: {
        navigate: (page: string) => navigationModel.navigate(page),
        goHome: () => navigationModel.goHome(),
      },

      theming: {
        setTheme: (theme: string) => themingModel.setTheme(theme),
        setFontSize: (fontSize: string) => themingModel.setFontSize(fontSize),
        toggleTheme: () => themingModel.toggleTheme(),
      },

      // Cross-cutting actions that use multiple models
      global: {
        reset: () => {
          navigationModel.goHome();
          themingModel.setTheme('light');
          themingModel.setFontSize('medium');
        },

        navigateWithTheme: (page: string, theme: string) => {
          navigationModel.navigate(page);
          themingModel.setTheme(theme);
        },
      },
    };

    // Test initial state
    expect(navigationModel.getCurrentPage()).toBe('home');
    expect(themingModel.getTheme()).toBe('light');

    // Test namespaced actions
    actions.navigation.navigate('products');
    expect(navigateSpy).toHaveBeenCalledWith('products');
    expect(navigationModel.getCurrentPage()).toBe('products');
    expect(navigationModel.getBreadcrumbs()).toEqual(['home', 'products']);

    actions.theming.setTheme('dark');
    expect(setThemeSpy).toHaveBeenCalledWith('dark');
    expect(themingModel.getTheme()).toBe('dark');

    // Test cross-cutting action
    actions.global.reset();
    expect(navigationModel.getCurrentPage()).toBe('home');
    expect(themingModel.getTheme()).toBe('light');
    expect(themingModel.getFontSize()).toBe('medium');

    // Test complex composed action
    actions.global.navigateWithTheme('settings', 'dark');
    expect(navigateSpy).toHaveBeenCalledWith('settings');
    expect(setThemeSpy).toHaveBeenCalledWith('dark');
    expect(navigationModel.getCurrentPage()).toBe('settings');
    expect(themingModel.getTheme()).toBe('dark');
  });
});
