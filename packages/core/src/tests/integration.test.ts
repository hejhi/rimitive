import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import { createModel } from '../model';
import { withStoreSubscribe } from '../state';

describe('Iteration 1: Integration Tests', () => {
  describe('Counter Model with State and Reactivity', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('creates a counter model that updates reactively', () => {
      // Create a test store for the counter
      interface CounterState {
        count: number;
        lastUpdated: number;
      }

      const counterStore = create<CounterState>(() => ({
        count: 0,
        lastUpdated: Date.now(),
      }));

      // Create a subscriber that selects all state
      const subscriber = withStoreSubscribe(counterStore, (state) => state);

      // Create a counter model with getters and mutations
      const { model } = createModel(subscriber)(
        (_set, _get, selectedState) => ({
          // Getters
          getCount: () => selectedState.count,
          getLastUpdated: () => selectedState.lastUpdated,

          // Mutations
          increment: () => {
            // Add a slight delay to ensure timestamp is different
            const now = Date.now();
            counterStore.setState((state) => ({
              count: state.count + 1,
              lastUpdated: now,
            }));
          },

          decrement: () =>
            counterStore.setState((state) => ({
              count: state.count - 1,
              lastUpdated: Date.now(),
            })),

          reset: () =>
            counterStore.setState({
              count: 0,
              lastUpdated: Date.now(),
            }),

          setCount: (value: number) =>
            counterStore.setState({
              count: value,
              lastUpdated: Date.now(),
            }),
        })
      );

      // Initial state check
      expect(model.getCount()).toBe(0);

      // Test reactivity with increment
      const initialTimestamp = model.getLastUpdated();
      // Force a delay before incrementing
      vi.advanceTimersByTime(100);
      model.increment();
      expect(model.getCount()).toBe(1);
      expect(model.getLastUpdated()).not.toBe(initialTimestamp);

      // Test reactivity with decrement
      model.decrement();
      expect(model.getCount()).toBe(0);

      // Test reactivity with setCount
      model.setCount(42);
      expect(model.getCount()).toBe(42);

      // Test reactivity with reset
      model.reset();
      expect(model.getCount()).toBe(0);

      // Test subscription to model changes
      const mockSubscriber = vi.fn();
      const unsubscribe = subscriber.subscribe(mockSubscriber);

      model.increment();
      expect(mockSubscriber).toHaveBeenCalled();

      // Test unsubscribe
      unsubscribe();
      model.increment();
      expect(mockSubscriber).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple State Stores with Dependent Values', () => {
    it('combines multiple state stores with dependent calculated values', () => {
      // Create the user store
      interface UserState {
        name: string;
        role: string;
      }

      const userStore = create<UserState>(() => ({
        name: 'John Doe',
        role: 'user',
      }));

      // Create the tasks store
      interface TasksState {
        tasks: { id: number; title: string; completed: boolean }[];
        filter: 'all' | 'active' | 'completed';
      }

      const tasksStore = create<TasksState>(() => ({
        tasks: [
          { id: 1, title: 'Task 1', completed: false },
          { id: 2, title: 'Task 2', completed: true },
        ],
        filter: 'all',
      }));

      // Create subscribers for each store
      const userSubscriber = withStoreSubscribe(userStore, (state) => state);
      const tasksSubscriber = withStoreSubscribe(tasksStore, (state) => state);

      // Create individual models
      const { model: userModel } = createModel(userSubscriber)(
        (_set, _get, selectedState) => ({
          getName: () => selectedState.name,
          getRole: () => selectedState.role,
          setName: (name: string) => userStore.setState({ name }),
          setRole: (role: string) => userStore.setState({ role }),
          isAdmin: () => selectedState.role === 'admin',
        })
      );

      const { model: tasksModel } = createModel(tasksSubscriber)(
        (_set, _get, selectedState) => ({
          getTasks: () => selectedState.tasks,
          getFilter: () => selectedState.filter,
          addTask: (title: string) => {
            tasksStore.setState((state) => ({
              tasks: [
                ...state.tasks,
                {
                  id: Math.max(0, ...state.tasks.map((t) => t.id)) + 1,
                  title,
                  completed: false,
                },
              ],
            }));
          },
          toggleTask: (id: number) => {
            tasksStore.setState((state) => ({
              tasks: state.tasks.map((task) =>
                task.id === id ? { ...task, completed: !task.completed } : task
              ),
            }));
          },
          setFilter: (filter: 'all' | 'active' | 'completed') => {
            tasksStore.setState({ filter });
          },
          getFilteredTasks: () => {
            const filter = selectedState.filter;
            return selectedState.tasks.filter((task) => {
              if (filter === 'all') return true;
              if (filter === 'active') return !task.completed;
              if (filter === 'completed') return task.completed;
              return true;
            });
          },
        })
      );

      // Create combined subscriber that merges both stores
      const combinedSubscriber = {
        subscribe: (
          callback: (
            state: UserState & {
              tasks: TasksState['tasks'];
              filter: TasksState['filter'];
            }
          ) => void
        ) => {
          const unsubUser = userSubscriber.subscribe((userState) => {
            const tasksState = tasksSubscriber.getState();
            callback({ ...userState, ...tasksState });
          });

          const unsubTasks = tasksSubscriber.subscribe((tasksState) => {
            const userState = userSubscriber.getState();
            callback({ ...userState, ...tasksState });
          });

          return () => {
            unsubUser();
            unsubTasks();
          };
        },
        getState: () => {
          return {
            ...userSubscriber.getState(),
            ...tasksSubscriber.getState(),
          };
        },
      };

      // Create the combined model with computations that depend on both states
      const { model: combinedModel } = createModel(combinedSubscriber)(
        (_set, _get, selectedState) => ({
          // User-related methods
          getUserName: () => selectedState.name,
          isAdmin: () => selectedState.role === 'admin',

          // Task-related methods
          getFilteredTasks: () => {
            const filter = selectedState.filter;
            return selectedState.tasks.filter((task) => {
              if (filter === 'all') return true;
              if (filter === 'active') return !task.completed;
              if (filter === 'completed') return task.completed;
              return true;
            });
          },

          // Combined/dependent computations
          getTaskSummary: () => {
            const total = selectedState.tasks.length;
            const completed = selectedState.tasks.filter(
              (t) => t.completed
            ).length;
            return {
              total,
              completed,
              active: total - completed,
              percentComplete:
                total === 0 ? 0 : Math.round((completed / total) * 100),
            };
          },

          canManageTasks: () =>
            selectedState.role === 'admin' || selectedState.role === 'manager',

          getDisplayName: () => `${selectedState.name} (${selectedState.role})`,
        })
      );

      // Test initial values from individual models
      expect(userModel.getName()).toBe('John Doe');
      expect(tasksModel.getTasks().length).toBe(2);

      // Test that combined model has access to both stores
      expect(combinedModel.getUserName()).toBe('John Doe');
      expect(combinedModel.getFilteredTasks().length).toBe(2);

      // Test computed values that depend on both stores
      expect(combinedModel.getTaskSummary()).toEqual({
        total: 2,
        completed: 1,
        active: 1,
        percentComplete: 50,
      });

      expect(combinedModel.canManageTasks()).toBe(false);
      expect(combinedModel.getDisplayName()).toBe('John Doe (user)');

      // Test reactivity when updating the user store
      userStore.setState({ role: 'admin' });
      expect(combinedModel.isAdmin()).toBe(true);
      expect(combinedModel.canManageTasks()).toBe(true);
      expect(combinedModel.getDisplayName()).toBe('John Doe (admin)');

      // Test reactivity when updating the tasks store
      tasksModel.addTask('Task 3');
      expect(combinedModel.getFilteredTasks().length).toBe(3);
      expect(combinedModel.getTaskSummary().total).toBe(3);
      expect(combinedModel.getTaskSummary().percentComplete).toBe(33);

      // Test filter functionality
      tasksModel.setFilter('completed');
      expect(tasksModel.getFilteredTasks().length).toBe(1);
      expect(combinedModel.getFilteredTasks().length).toBe(1);

      tasksModel.setFilter('active');
      expect(combinedModel.getFilteredTasks().length).toBe(2);

      // Toggle a task and verify the counts update
      tasksModel.toggleTask(1);
      expect(combinedModel.getTaskSummary()).toEqual({
        total: 3,
        completed: 2,
        active: 1,
        percentComplete: 67,
      });
    });
  });
});
