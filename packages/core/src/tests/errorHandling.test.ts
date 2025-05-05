import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createModel } from '../model';
import { withStoreSubscribe } from '../state';

describe('Error Handling in Actions', () => {
  // Now we'll create separate test cases in the same describe block
  // Each test will create its own state and model

  it('implements error handling with try/catch in actions', async () => {
    // Create a test store
    interface AppState {
      data: string[];
      isLoading: boolean;
      error: string | null;
    }

    const appStore = create<AppState>(() => ({
      data: [],
      isLoading: false,
      error: null,
    }));

    // Create a subscriber
    const subscriber = withStoreSubscribe(appStore, (state) => state);

    // Mock API function that might fail
    const mockApiCall = vi.fn().mockImplementation((shouldFail: boolean) => {
      if (shouldFail) {
        throw new Error('API request failed');
      }
      return ['item1', 'item2', 'item3'];
    });

    // Create model with methods that might throw errors
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getData: () => selectedState.data,
      isLoading: () => selectedState.isLoading,
      getError: () => selectedState.error,

      setLoading: (isLoading: boolean) => {
        appStore.setState({ isLoading });
      },

      setError: (error: string | null) => {
        appStore.setState({ error });
      },

      setData: (data: string[]) => {
        appStore.setState({ data });
      },

      // Method that might throw
      fetchData: (shouldFail: boolean) => {
        // This will throw if shouldFail is true
        const data = mockApiCall(shouldFail);
        appStore.setState({
          data,
          isLoading: false,
          error: null,
        });
        return data;
      },

      // Method to reset state
      resetState: () => {
        appStore.setState({
          data: [],
          isLoading: false,
          error: null,
        });
      },
    }));

    // Spy on model methods
    const setLoadingSpy = vi.spyOn(model, 'setLoading');
    const setErrorSpy = vi.spyOn(model, 'setError');
    const setDataSpy = vi.spyOn(model, 'setData');
    const fetchDataSpy = vi.spyOn(model, 'fetchData');

    // Create actions with error handling
    const actions = {
      // Action that includes error handling
      fetchDataSafely: async (shouldFail: boolean) => {
        // Start loading state
        model.setLoading(true);
        model.setError(null);

        try {
          // Attempt to fetch data
          const data = model.fetchData(shouldFail);
          model.setData(data);
          return { success: true, data };
        } catch (error) {
          // Handle error
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          model.setError(errorMessage);
          model.setLoading(false);
          return { success: false, error: errorMessage };
        }
      },
    };

    // Test successful fetch
    const successResult = await actions.fetchDataSafely(false);

    expect(setLoadingSpy).toHaveBeenCalledWith(true);
    expect(fetchDataSpy).toHaveBeenCalledWith(false);
    expect(setDataSpy).toHaveBeenCalledWith(['item1', 'item2', 'item3']);
    expect(successResult).toEqual({
      success: true,
      data: ['item1', 'item2', 'item3'],
    });
    expect(model.getData()).toEqual(['item1', 'item2', 'item3']);
    expect(model.getError()).toBe(null);

    // Reset spies
    setLoadingSpy.mockClear();
    setErrorSpy.mockClear();
    fetchDataSpy.mockClear();

    // Test failed fetch
    const failureResult = await actions.fetchDataSafely(true);

    expect(setLoadingSpy).toHaveBeenCalledWith(true);
    expect(fetchDataSpy).toHaveBeenCalledWith(true);
    expect(setErrorSpy).toHaveBeenCalledWith('API request failed');
    expect(failureResult).toEqual({
      success: false,
      error: 'API request failed',
    });
    expect(model.getError()).toBe('API request failed');
    expect(model.isLoading()).toBe(false);
  });

  it('implements retry logic in actions', async () => {
    // Create a test store
    interface AppState {
      data: string[];
      isLoading: boolean;
      error: string | null;
    }

    const appStore = create<AppState>(() => ({
      data: [],
      isLoading: false,
      error: null,
    }));

    // Create a subscriber
    const subscriber = withStoreSubscribe(appStore, (state) => state);

    // Mock API function that might fail
    const mockApiCall = vi.fn().mockImplementation((shouldFail: boolean) => {
      if (shouldFail) {
        throw new Error('API request failed');
      }
      return ['item1', 'item2', 'item3'];
    });

    // Create model with methods that might throw errors
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getData: () => selectedState.data,
      isLoading: () => selectedState.isLoading,
      getError: () => selectedState.error,

      setLoading: (isLoading: boolean) => {
        appStore.setState({ isLoading });
      },

      setError: (error: string | null) => {
        appStore.setState({ error });
      },

      setData: (data: string[]) => {
        appStore.setState({ data });
      },

      // Method that might throw
      fetchData: (shouldFail: boolean) => {
        // This will throw if shouldFail is true
        const data = mockApiCall(shouldFail);
        appStore.setState({
          data,
          isLoading: false,
          error: null,
        });
        return data;
      },
    }));

    // Spy on model methods
    const setLoadingSpy = vi.spyOn(model, 'setLoading');
    const fetchDataSpy = vi.spyOn(model, 'fetchData');

    // Create action with retry logic
    const actions = {
      // Action with retry logic
      fetchWithRetry: async (maxRetries = 3) => {
        model.setLoading(true);

        let retries = 0;

        while (retries < maxRetries) {
          try {
            // Try to fetch with varying fail conditions
            // We'll use retries === 0 to indicate first attempt should fail
            const data = model.fetchData(retries === 0);
            model.setData(data);
            return { success: true, data, attempts: retries + 1 };
          } catch (error) {
            retries++;

            if (retries >= maxRetries) {
              // Max retries reached, handle error
              const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
              model.setError(
                `Failed after ${maxRetries} attempts: ${errorMessage}`
              );
              model.setLoading(false);
              return { success: false, error: errorMessage, attempts: retries };
            }
          }
        }

        // This shouldn't be reached but TypeScript needs the return
        return { success: false, error: 'Unknown error', attempts: retries };
      },
    };

    // Test retry logic with eventual success
    const result = await actions.fetchWithRetry(3);

    expect(setLoadingSpy).toHaveBeenCalledWith(true);
    // Should have been called twice - first with fail=true, then with fail=false
    expect(fetchDataSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      success: true,
      data: ['item1', 'item2', 'item3'],
      attempts: 2,
    });
    expect(model.getData()).toEqual(['item1', 'item2', 'item3']);
  });
});
