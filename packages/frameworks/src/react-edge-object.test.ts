import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { createComponent, type ComponentContext } from '@lattice/core';
import { useSignal } from './react';

describe('React object mutations test', () => {
  it('should handle complex object mutations correctly', () => {
    const UserComponent = ({ 
      store, 
      set 
    }: ComponentContext<{ 
      user: { name: string; age: number; preferences: { theme: string } } 
    }>) => ({
      user: store.user,
      updateName: (name: string) => set(store.user, current => ({ ...current, name })),
      updateTheme: (theme: string) => set(store.user, current => ({
        ...current,
        preferences: { ...current.preferences, theme }
      })),
    });
    
    const context = createComponent({ 
      user: { name: 'Alice', age: 30, preferences: { theme: 'light' } } 
    });
    
    const component = UserComponent(context);
    const { result } = renderHook(() => useSignal(component.user));
    
    expect(result.current.name).toBe('Alice');
    expect(result.current.preferences.theme).toBe('light');
    
    act(() => {
      component.updateTheme('dark');
    });
    
    expect(result.current.preferences.theme).toBe('dark');
    expect(result.current.name).toBe('Alice'); // Unchanged
  });
});