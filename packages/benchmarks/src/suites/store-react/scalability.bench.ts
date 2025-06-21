/**
 * @fileoverview Scalability benchmarks for @lattice/store-react
 * 
 * Tests performance with large state trees, many subscribers,
 * and high-frequency updates to ensure the library scales well.
 */

import { describe, bench } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import { useStore, useStoreSelector, createStoreContext } from '@lattice/store/react';
import { create as createZustand } from 'zustand';
import React from 'react';

describe('Scalability - Large State Trees', () => {
  type LargeState = {
    entities: Record<string, {
      id: string;
      name: string;
      description: string;
      metadata: Record<string, unknown>;
      relationships: string[];
    }>;
    indices: {
      byName: Record<string, string[]>;
      byType: Record<string, string[]>;
      byDate: Record<string, string[]>;
    };
    ui: {
      selectedIds: Set<string>;
      expandedIds: Set<string>;
      filters: Record<string, unknown>;
    };
    updateEntity: (id: string, updates: Partial<LargeState['entities'][string]>) => void;
    addEntity: (entity: LargeState['entities'][string]) => void;
    removeEntity: (id: string) => void;
    toggleSelection: (id: string) => void;
  };

  // Pre-generate large state data outside of benchmarks
  const ENTITY_COUNT = 1000;
  const generateLargeStateData = () => {
    const entities: LargeState['entities'] = {};
    
    for (let i = 0; i < ENTITY_COUNT; i++) {
      const id = `entity-${i}`;
      entities[id] = {
        id,
        name: `Entity ${i}`,
        description: `Description for entity ${i}`,
        metadata: {
          created: new Date().toISOString(),
          type: `type-${i % 10}`,
          priority: i % 5,
          tags: [`tag-${i % 20}`, `tag-${i % 30}`]
        },
        relationships: Array.from(
          { length: Math.floor(Math.random() * 5) },
          (_, j) => `entity-${(i + j + 1) % ENTITY_COUNT}`
        )
      };
    }

    return {
      entities,
      indices: {
        byName: {},
        byType: {},
        byDate: {}
      },
      ui: {
        selectedIds: new Set<string>(),
        expandedIds: new Set<string>(),
        filters: {}
      }
    };
  };

  // Generate data once
  const largeStateData = generateLargeStateData();

  const setupStoreReact = () => {
    return renderHook(() =>
      useStore<LargeState>((set, get) => ({
        ...largeStateData,
        updateEntity: (id, updates) => {
          const entity = get().entities[id];
          if (entity && updates) {
            set({
              entities: {
                ...get().entities,
                [id]: { ...entity, ...updates }
              }
            });
          }
        },
        addEntity: (entity) => set({
          entities: { ...get().entities, [entity.id]: entity }
        }),
        removeEntity: (id) => {
          const { [id]: removed, ...rest } = get().entities;
          set({ entities: rest });
        },
        toggleSelection: (id) => {
          const selectedIds = new Set(get().ui.selectedIds);
          if (selectedIds.has(id)) {
            selectedIds.delete(id);
          } else {
            selectedIds.add(id);
          }
          set({ ui: { ...get().ui, selectedIds } });
        }
      }))
    );
  };

  bench('@lattice/store-react - large state operations', () => {
    const { result } = setupStoreReact();

    // Measure ONLY the operations on large state
    act(() => {
      // Perform operations on large state
      for (let i = 0; i < 100; i++) {
        const id = `entity-${i}`;
        result.current.updateEntity(id, { name: `Updated ${i}` });
        result.current.toggleSelection(id);
      }

      // Add new entities
      for (let i = 0; i < 50; i++) {
        result.current.addEntity({
          id: `new-entity-${i}`,
          name: `New Entity ${i}`,
          description: `New description ${i}`,
          metadata: {},
          relationships: []
        });
      }
    });
  });

  const setupZustand = () => {
    const useStore = createZustand<LargeState>((set, get) => ({
      ...largeStateData,
      updateEntity: (id, updates) => {
        const entity = get().entities[id];
        if (entity && updates) {
          set({
            entities: {
              ...get().entities,
              [id]: { ...entity, ...updates }
            }
          });
        }
      },
      addEntity: (entity) => set({
        entities: { ...get().entities, [entity.id]: entity }
      }),
      removeEntity: (id) => {
        const { [id]: removed, ...rest } = get().entities;
        set({ entities: rest });
      },
      toggleSelection: (id) => {
        const selectedIds = new Set(get().ui.selectedIds);
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
        } else {
          selectedIds.add(id);
        }
        set({ ui: { ...get().ui, selectedIds } });
      }
    }));
    return renderHook(() => useStore());
  };

  bench('zustand - large state operations', () => {
    const { result } = setupZustand();

    // Measure ONLY the operations on large state
    act(() => {
      // Perform operations on large state
      for (let i = 0; i < 100; i++) {
        const id = `entity-${i}`;
        result.current.updateEntity(id, { name: `Updated ${i}` });
        result.current.toggleSelection(id);
      }

      // Add new entities
      for (let i = 0; i < 50; i++) {
        result.current.addEntity({
          id: `new-entity-${i}`,
          name: `New Entity ${i}`,
          description: `New description ${i}`,
          metadata: {},
          relationships: []
        });
      }
    });
  });
});

describe('Scalability - Many Subscribers', () => {
  const SUBSCRIBER_COUNT = 100;

  bench(`@lattice/store-react - ${SUBSCRIBER_COUNT} subscribers`, () => {
    // Create a store context to share one store across multiple components
    const StoreContext = createStoreContext<{
      value: number;
      update: (v: number) => void;
    }>();

    // Create the actual store instance
    const { result: storeResult } = renderHook(() =>
      useStore<{
        value: number;
        update: (v: number) => void;
      }>((set) => ({
        value: 0,
        update: (v) => set({ value: v })
      }))
    );

    // Component that subscribes to the shared store
    const SubscriberComponent = () => {
      const store = StoreContext.useStore();
      // Subscribe to value changes
      useStoreSelector(store, (s) => s.value);
      return null;
    };

    // Render many subscriber components within the provider
    const { unmount } = render(
      React.createElement(
        StoreContext.Provider,
        { value: storeResult.current },
        Array.from({ length: SUBSCRIBER_COUNT }, (_, i) => 
          React.createElement(SubscriberComponent, { key: i })
        )
      )
    );

    // Trigger updates (all subscribers should be notified)
    act(() => {
      for (let i = 0; i < 100; i++) {
        storeResult.current.update(i);
      }
    });

    // Cleanup
    unmount();
  });

  bench(`zustand - ${SUBSCRIBER_COUNT} subscribers`, () => {
    // Create ONE store that will have many subscribers
    const useZustandStore = createZustand<{
      value: number;
      update: (v: number) => void;
    }>((set) => ({
      value: 0,
      update: (v) => set({ value: v })
    }));

    // Component that subscribes to the store
    const SubscriberComponent = () => {
      const value = useZustandStore((s) => s.value);
      void value; // Subscribe to value changes
      return null;
    };

    // Store reference to update from outside
    let updateFn: ((v: number) => void) | null = null;
    
    const UpdateCapture = () => {
      const update = useZustandStore((s) => s.update);
      updateFn = update;
      return null;
    };

    // Render many subscriber components
    const { unmount } = render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(UpdateCapture),
        Array.from({ length: SUBSCRIBER_COUNT }, (_, i) => 
          React.createElement(SubscriberComponent, { key: i })
        )
      )
    );

    // Trigger updates (all subscribers should be notified)
    act(() => {
      for (let i = 0; i < 100; i++) {
        updateFn!(i);
      }
    });

    // Cleanup
    unmount();
  });
});

describe('Scalability - High-Frequency Updates', () => {
  const UPDATE_COUNT = 10000;

  bench(`@lattice/store-react - ${UPDATE_COUNT} rapid updates`, () => {
    const { result } = renderHook(() =>
      useStore<{
        counter: number;
        lastUpdate: number;
        increment: () => void;
        batchIncrement: (count: number) => void;
      }>((set, get) => ({
        counter: 0,
        lastUpdate: Date.now(),
        increment: () => set({ 
          counter: get().counter + 1,
          lastUpdate: Date.now()
        }),
        batchIncrement: (count) => set({ 
          counter: get().counter + count,
          lastUpdate: Date.now()
        })
      }))
    );

    act(() => {
      // Rapid individual updates
      for (let i = 0; i < UPDATE_COUNT; i++) {
        result.current.increment();
      }
    });
  });

  bench(`zustand - ${UPDATE_COUNT} rapid updates`, () => {
    const useStore = createZustand<{
      counter: number;
      lastUpdate: number;
      increment: () => void;
      batchIncrement: (count: number) => void;
    }>((set, get) => ({
      counter: 0,
      lastUpdate: Date.now(),
      increment: () => set({ 
        counter: get().counter + 1,
        lastUpdate: Date.now()
      }),
      batchIncrement: (count) => set({ 
        counter: get().counter + count,
        lastUpdate: Date.now()
      })
    }));

    const { result } = renderHook(() => useStore());

    act(() => {
      // Rapid individual updates
      for (let i = 0; i < UPDATE_COUNT; i++) {
        result.current.increment();
      }
    });
  });
});

describe('Scalability - Deep Nesting Performance', () => {
  type DeepState = {
    level1: {
      level2: {
        level3: {
          level4: {
            level5: {
              value: number;
              items: Array<{ id: string; data: string }>;
            };
          };
        };
      };
    };
    updateDeepValue: (value: number) => void;
    addDeepItem: (item: { id: string; data: string }) => void;
  };

  bench('@lattice/store-react - deep nested updates', () => {
    const { result } = renderHook(() =>
      useStore<DeepState>((set, get) => ({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 0,
                  items: []
                }
              }
            }
          }
        },
        updateDeepValue: (value) => set({
          level1: {
            ...get().level1,
            level2: {
              ...get().level1.level2,
              level3: {
                ...get().level1.level2.level3,
                level4: {
                  ...get().level1.level2.level3.level4,
                  level5: {
                    ...get().level1.level2.level3.level4.level5,
                    value
                  }
                }
              }
            }
          }
        }),
        addDeepItem: (item) => set({
          level1: {
            ...get().level1,
            level2: {
              ...get().level1.level2,
              level3: {
                ...get().level1.level2.level3,
                level4: {
                  ...get().level1.level2.level3.level4,
                  level5: {
                    ...get().level1.level2.level3.level4.level5,
                    items: [...get().level1.level2.level3.level4.level5.items, item]
                  }
                }
              }
            }
          }
        })
      }))
    );

    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.updateDeepValue(i);
        result.current.addDeepItem({ id: `item-${i}`, data: `Data ${i}` });
      }
    });
  });

  bench('zustand - deep nested updates', () => {
    const useStore = createZustand<DeepState>((set, get) => ({
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: 0,
                items: []
              }
            }
          }
        }
      },
      updateDeepValue: (value) => set({
        level1: {
          ...get().level1,
          level2: {
            ...get().level1.level2,
            level3: {
              ...get().level1.level2.level3,
              level4: {
                ...get().level1.level2.level3.level4,
                level5: {
                  ...get().level1.level2.level3.level4.level5,
                  value
                }
              }
            }
          }
        }
      }),
      addDeepItem: (item) => set({
        level1: {
          ...get().level1,
          level2: {
            ...get().level1.level2,
            level3: {
              ...get().level1.level2.level3,
              level4: {
                ...get().level1.level2.level3.level4,
                level5: {
                  ...get().level1.level2.level3.level4.level5,
                  items: [...get().level1.level2.level3.level4.level5.items, item]
                }
              }
            }
          }
        }
      })
    }));

    const { result } = renderHook(() => useStore());

    act(() => {
      for (let i = 0; i < 100; i++) {
        result.current.updateDeepValue(i);
        result.current.addDeepItem({ id: `item-${i}`, data: `Data ${i}` });
      }
    });
  });
});