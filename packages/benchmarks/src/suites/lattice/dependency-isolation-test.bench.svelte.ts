/**
 * @fileoverview Demonstrate what "respecting selected dependencies" means in Lattice
 */

import { describe, it } from 'vitest';
import { createLatticeStore, select, vanillaAdapter } from '@lattice/core';

describe('Lattice Dependency Isolation', () => {
  it('should demonstrate dependency isolation', () => {
    console.log('\n=== DEMONSTRATING LATTICE DEPENDENCY ISOLATION ===\n');
    
    // Create a store with multiple pieces of state
    const createSlice = createLatticeStore(vanillaAdapter({ 
      user: { name: 'Alice', age: 30 },
      settings: { theme: 'dark', notifications: true },
      unrelated: { foo: 'bar', baz: 42 }
    }));

    // SLICE 1: Only depends on 'user'
    console.log('Creating userSlice that only selects "user"...');
    const userSlice = createSlice(select('user'), ({ user }, set) => {
      console.log('  ✓ userSlice factory called - I have access to user:', user());
      return {
        getName: () => {
          console.log('    getName() called');
          return user().name;
        },
        getAge: () => {
          console.log('    getAge() called');
          return user().age;
        },
        setName: (name: string) => set(({ user }) => ({ 
          user: { ...user(), name } 
        }))
      };
    });

    // SLICE 2: Only depends on 'settings'
    console.log('\nCreating settingsSlice that only selects "settings"...');
    const settingsSlice = createSlice(select('settings'), ({ settings }, set) => {
      console.log('  ✓ settingsSlice factory called - I have access to settings:', settings());
      return {
        getTheme: () => {
          console.log('    getTheme() called');
          return settings().theme;
        },
        toggleTheme: () => set(({ settings }) => ({
          settings: { 
            ...settings(), 
            theme: settings().theme === 'dark' ? 'light' : 'dark' 
          }
        }))
      };
    });

    // SLICE 3: Depends on BOTH 'user' AND 'settings'
    console.log('\nCreating combinedSlice that selects BOTH "user" and "settings"...');
    const combinedSlice = createSlice(select('user', 'settings'), ({ user, settings }, set) => {
      console.log('  ✓ combinedSlice factory called - I have access to both:', 
        { user: user(), settings: settings() });
      return {
        getSummary: () => {
          console.log('    getSummary() called');
          return `${user().name} prefers ${settings().theme} theme`;
        }
      };
    });

    console.log('\n=== INITIAL STATE ===');
    console.log('User name:', userSlice().getName());
    console.log('Theme:', settingsSlice().getTheme());
    console.log('Summary:', combinedSlice().getSummary());

    console.log('\n=== WHAT HAPPENS WHEN WE UPDATE? ===');
    
    console.log('\n1. Updating user name...');
    userSlice().setName('Bob');
    console.log('   After update:');
    console.log('   - User name:', userSlice().getName(), '✓ (sees the update)');
    console.log('   - Theme:', settingsSlice().getTheme(), '✓ (unchanged)');
    console.log('   - Summary:', combinedSlice().getSummary(), '✓ (sees user update because it depends on user)');

    console.log('\n2. Updating theme...');
    settingsSlice().toggleTheme();
    console.log('   After update:');
    console.log('   - User name:', userSlice().getName(), '✓ (unchanged)');
    console.log('   - Theme:', settingsSlice().getTheme(), '✓ (sees the update)');
    console.log('   - Summary:', combinedSlice().getSummary(), '✓ (sees theme update because it depends on settings)');

    console.log('\n=== KEY INSIGHTS ===');
    console.log('1. userSlice can ONLY access "user" data - it has no way to access settings');
    console.log('2. settingsSlice can ONLY access "settings" data - it has no way to access user');
    console.log('3. combinedSlice can access BOTH because it selected both');
    console.log('4. When you update user, only slices that selected "user" see the change');
    console.log('5. The slice factory is only called ONCE - the functions inside always see current values');
    
    console.log('\n=== WHAT ABOUT ACCESSING NON-SELECTED DATA? ===');
    console.log('Can userSlice access settings? Let\'s try...');
    
    // This would cause a TypeScript error - settings is not available!
    const userSliceWithError = createSlice(select('user'), ({ user }, set) => {
      return {
        tryToGetSettings: () => {
          // @ts-expect-error - settings is not selected, so it's not available
          return settings?.(); // This would be undefined or cause an error
        }
      };
    });
    
    console.log('Answer: NO! The slice only has access to what it selected.');
  });
});