/**
 * @fileoverview Comprehensive benchmark comparing Svelte Runes vs Lattice
 * 
 * This single benchmark covers:
 * 1. Basic reactivity performance
 * 2. Caching/lazy evaluation behavior
 * 3. Complex state management patterns
 * 4. Real-world usage scenarios
 */

import { describe, bench } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

const ITERATIONS = 1000;

describe('Svelte Runes vs Lattice - Comprehensive Comparison', () => {
  
  describe('Basic Reactivity', () => {
    bench('Svelte - simple counter with derived value', () => {
      const state = $state({ count: 0 });
      const doubled = $derived(state.count * 2);
      
      for (let i = 0; i < ITERATIONS; i++) {
        state.count = i;
        void doubled;
      }
    });

    bench('Lattice - simple counter with derived value', () => {
      const createSlice = createLatticeStore(vanillaAdapter({ count: 0 }));
      const slice = createSlice(select('count'), ({ count }, set) => ({
        doubled: () => count() * 2,
        setCount: (n: number) => set(() => ({ count: n })),
      }));
      
      const counter = slice();
      
      for (let i = 0; i < ITERATIONS; i++) {
        counter.setCount(i);
        void counter.doubled();
      }
    });
  });

  describe('Caching Behavior', () => {
    bench('Svelte - multiple accesses without state change', () => {
      const state = $state({ value: 1 });
      let computations = 0;
      const expensive = $derived.by(() => {
        computations++;
        return state.value * state.value * state.value;
      });
      
      // Pattern: change once, access many times
      for (let i = 0; i < 10; i++) {
        state.value = i;
        for (let j = 0; j < 100; j++) {
          void expensive;
        }
      }
    });

    bench('Lattice - multiple accesses without state change', () => {
      let computations = 0;
      const createSlice = createLatticeStore(vanillaAdapter({ value: 1 }));
      const slice = createSlice(select('value'), ({ value }, set) => ({
        expensive: () => {
          computations++;
          return value() * value() * value();
        },
        setValue: (n: number) => set(() => ({ value: n })),
      }));
      
      const s = slice();
      
      // Same pattern: change once, access many times
      for (let i = 0; i < 10; i++) {
        s.setValue(i);
        for (let j = 0; j < 100; j++) {
          void s.expensive();
        }
      }
    });
  });

  describe('Complex State Management', () => {
    const COMPLEX_ITERATIONS = 100;
    
    bench('Svelte - multi-slice dashboard simulation', () => {
      // Simulate a dashboard with multiple interconnected parts
      const state = $state({
        user: { name: 'John', role: 'admin', lastLogin: Date.now() },
        metrics: { views: 1000, clicks: 50, revenue: 5000 },
        settings: { theme: 'dark', notifications: true },
      });
      
      // Derived calculations
      const ctr = $derived(state.metrics.clicks / state.metrics.views);
      const revenuePerClick = $derived(state.metrics.revenue / state.metrics.clicks);
      const isAdmin = $derived(state.user.role === 'admin');
      const displayTheme = $derived(state.settings.theme);
      
      // Simulate realistic updates
      for (let i = 0; i < COMPLEX_ITERATIONS; i++) {
        const action = i % 5;
        
        switch (action) {
          case 0: // User action
            state.user.lastLogin = Date.now();
            void isAdmin;
            break;
          case 1: // Metrics update
            state.metrics.views += 10;
            state.metrics.clicks += 1;
            void ctr;
            void revenuePerClick;
            break;
          case 2: // Revenue update
            state.metrics.revenue += 100;
            void revenuePerClick;
            break;
          case 3: // Settings change
            state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
            void displayTheme;
            break;
          case 4: // Read all
            void ctr;
            void revenuePerClick;
            void isAdmin;
            void displayTheme;
            break;
        }
      }
    });

    bench('Lattice - multi-slice dashboard simulation', () => {
      // Same dashboard structure
      const createSlice = createLatticeStore(vanillaAdapter({
        user: { name: 'John', role: 'admin', lastLogin: Date.now() },
        metrics: { views: 1000, clicks: 50, revenue: 5000 },
        settings: { theme: 'dark', notifications: true },
      }));
      
      // User slice
      const userSlice = createSlice(select('user'), ({ user }, set) => ({
        isAdmin: () => user().role === 'admin',
        updateLastLogin: () => set(({ user }) => ({
          user: { ...user(), lastLogin: Date.now() }
        })),
      }));
      
      // Metrics slice
      const metricsSlice = createSlice(select('metrics'), ({ metrics }, set) => ({
        ctr: () => metrics().clicks / metrics().views,
        revenuePerClick: () => metrics().revenue / metrics().clicks,
        recordView: () => set(({ metrics }) => ({
          metrics: { ...metrics(), views: metrics().views + 10, clicks: metrics().clicks + 1 }
        })),
        recordRevenue: () => set(({ metrics }) => ({
          metrics: { ...metrics(), revenue: metrics().revenue + 100 }
        })),
      }));
      
      // Settings slice
      const settingsSlice = createSlice(select('settings'), ({ settings }, set) => ({
        theme: () => settings().theme,
        toggleTheme: () => set(({ settings }) => ({
          settings: { ...settings(), theme: settings().theme === 'dark' ? 'light' : 'dark' }
        })),
      }));
      
      // Get instances
      const user = userSlice();
      const metrics = metricsSlice();
      const settings = settingsSlice();
      
      // Same realistic update pattern
      for (let i = 0; i < COMPLEX_ITERATIONS; i++) {
        const action = i % 5;
        
        switch (action) {
          case 0: // User action
            user.updateLastLogin();
            void user.isAdmin();
            break;
          case 1: // Metrics update
            metrics.recordView();
            void metrics.ctr();
            void metrics.revenuePerClick();
            break;
          case 2: // Revenue update
            metrics.recordRevenue();
            void metrics.revenuePerClick();
            break;
          case 3: // Settings change
            settings.toggleTheme();
            void settings.theme();
            break;
          case 4: // Read all
            void metrics.ctr();
            void metrics.revenuePerClick();
            void user.isAdmin();
            void settings.theme();
            break;
        }
      }
    });
  });

  describe('Real-World Patterns', () => {
    // Form handling simulation
    bench('Svelte - form with validation', () => {
      const form = $state({
        email: '',
        password: '',
        confirmPassword: '',
      });
      
      const validation = $derived.by(() => ({
        emailValid: form.email.includes('@'),
        passwordValid: form.password.length >= 8,
        passwordsMatch: form.password === form.confirmPassword,
        canSubmit: form.email.includes('@') && 
                   form.password.length >= 8 && 
                   form.password === form.confirmPassword
      }));
      
      // Simulate user typing
      const testEmails = ['a', 'ab', 'abc', 'abc@', 'abc@d', 'abc@def.com'];
      const testPasswords = ['1', '12', '123', '1234', '12345', '123456', '1234567', '12345678'];
      
      for (let i = 0; i < 50; i++) {
        form.email = testEmails[i % testEmails.length];
        void validation.emailValid;
        
        form.password = testPasswords[i % testPasswords.length];
        void validation.passwordValid;
        
        form.confirmPassword = i % 2 === 0 ? form.password : 'different';
        void validation.passwordsMatch;
        void validation.canSubmit;
      }
    });

    bench('Lattice - form with validation', () => {
      const createSlice = createLatticeStore(vanillaAdapter({
        email: '',
        password: '',
        confirmPassword: '',
      }));
      
      const formSlice = createSlice(
        select('email', 'password', 'confirmPassword'),
        ({ email, password, confirmPassword }, set) => ({
          emailValid: () => email().includes('@'),
          passwordValid: () => password().length >= 8,
          passwordsMatch: () => password() === confirmPassword(),
          canSubmit: () => 
            email().includes('@') && 
            password().length >= 8 && 
            password() === confirmPassword(),
          setEmail: (value: string) => set(() => ({ email: value })),
          setPassword: (value: string) => set(() => ({ password: value })),
          setConfirmPassword: (value: string) => set(() => ({ confirmPassword: value })),
        })
      );
      
      const form = formSlice();
      
      // Same simulation
      const testEmails = ['a', 'ab', 'abc', 'abc@', 'abc@d', 'abc@def.com'];
      const testPasswords = ['1', '12', '123', '1234', '12345', '123456', '1234567', '12345678'];
      
      for (let i = 0; i < 50; i++) {
        form.setEmail(testEmails[i % testEmails.length]);
        void form.emailValid();
        
        form.setPassword(testPasswords[i % testPasswords.length]);
        void form.passwordValid();
        
        form.setConfirmPassword(i % 2 === 0 ? testPasswords[i % testPasswords.length] : 'different');
        void form.passwordsMatch();
        void form.canSubmit();
      }
    });
  });
});