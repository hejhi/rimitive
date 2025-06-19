/**
 * @fileoverview Real-world scenario benchmarks for @lattice/store-react
 *
 * Simulates common application patterns like forms, data tables,
 * and shopping carts to measure performance in realistic use cases.
 */

import { describe, bench } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useStore,
} from '@lattice/store-react';
import { create as createZustand } from 'zustand';

describe('Real-World - Form Management', () => {
  type FormState = {
    fields: Record<
      string,
      {
        value: string;
        error?: string;
        touched: boolean;
      }
    >;
    isSubmitting: boolean;
    setFieldValue: (name: string, value: string) => void;
    setFieldError: (name: string, error: string) => void;
    setFieldTouched: (name: string) => void;
    validateField: (name: string) => void;
    submit: () => void;
  };

  const FIELD_COUNT = 50;
  const fieldNames = Array.from(
    { length: FIELD_COUNT },
    (_, i) => `field_${i}`
  );

  // Pre-generate initial fields outside benchmarks
  const initialFields: FormState['fields'] = {};
  fieldNames.forEach((name) => {
    initialFields[name] = { value: '', touched: false };
  });

  const setupStoreReact = () => {
    return renderHook(() =>
      useStore<FormState>((set, get) => ({
        fields: initialFields,
        isSubmitting: false,
        setFieldValue: (name, value) => {
          const field = get().fields[name];
          if (field) {
            set({
              fields: {
                ...get().fields,
                [name]: { ...field, value },
              },
            });
          }
        },
        setFieldError: (name, error) => {
          const field = get().fields[name];
          if (field) {
            set({
              fields: {
                ...get().fields,
                [name]: { ...field, error },
              },
            });
          }
        },
        setFieldTouched: (name) => {
          const field = get().fields[name];
          if (field) {
            set({
              fields: {
                ...get().fields,
                [name]: { ...field, touched: true },
              },
            });
          }
        },
        validateField: (name) => {
          const field = get().fields[name];
          if (field) {
            if (!field.value) {
              get().setFieldError(name, 'Required');
            } else if (field.value.length < 3) {
              get().setFieldError(name, 'Too short');
            } else {
              get().setFieldError(name, '');
            }
          }
        },
        submit: () => {
          set({ isSubmitting: true });
          // Simulate submission
          set({ isSubmitting: false });
        },
      }))
    );
  };

  bench('@lattice/store-react - complex form', () => {
    const { result } = setupStoreReact();

    // Measure ONLY the form operations
    act(() => {
      // Simulate user filling out form
      for (const fieldName of fieldNames) {
        result.current.setFieldValue(fieldName, `value_${fieldName}`);
        result.current.setFieldTouched(fieldName);
        result.current.validateField(fieldName);
      }

      // Change some values multiple times
      for (let i = 0; i < 20; i++) {
        const fieldName = fieldNames[i % fieldNames.length];
        if (fieldName) {
          result.current.setFieldValue(fieldName, `updated_${i}`);
          result.current.validateField(fieldName);
        }
      }

      result.current.submit();
    });
  });

  const setupZustand = () => {
    const useFormStore = createZustand<FormState>((set, get) => ({
      fields: initialFields,
      isSubmitting: false,
      setFieldValue: (name, value) =>
        set((state) => {
          const field = state.fields[name];
          if (!field) return state;
          return {
            fields: {
              ...state.fields,
              [name]: { ...field, value },
            },
          };
        }),
      setFieldError: (name, error) =>
        set((state) => {
          const field = state.fields[name];
          if (!field) return state;
          return {
            fields: {
              ...state.fields,
              [name]: { ...field, error },
            },
          };
        }),
      setFieldTouched: (name) =>
        set((state) => {
          const field = state.fields[name];
          if (!field) return state;
          return {
            fields: {
              ...state.fields,
              [name]: { ...field, touched: true },
            },
          };
        }),
      validateField: (name) => {
        const field = get().fields[name];
        if (field) {
          if (!field.value) {
            get().setFieldError(name, 'Required');
          } else if (field.value.length < 3) {
            get().setFieldError(name, 'Too short');
          } else {
            get().setFieldError(name, '');
          }
        }
      },
      submit: () => {
        set({ isSubmitting: true });
        // Simulate submission
        set({ isSubmitting: false });
      },
    }));

    return renderHook(() => useFormStore());
  };

  bench('zustand - complex form', () => {
    const { result } = setupZustand();

    // Measure ONLY the form operations
    act(() => {
      // Simulate user filling out form
      for (const fieldName of fieldNames) {
        result.current.setFieldValue(fieldName, `value_${fieldName}`);
        result.current.setFieldTouched(fieldName);
        result.current.validateField(fieldName);
      }

      // Change some values multiple times
      for (let i = 0; i < 20; i++) {
        const fieldName = fieldNames[i % fieldNames.length];
        if (fieldName) {
          result.current.setFieldValue(fieldName, `updated_${i}`);
          result.current.validateField(fieldName);
        }
      }

      result.current.submit();
    });
  });
});

describe('Real-World - Data Table', () => {
  type TableState = {
    data: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      department: string;
      salary: number;
      startDate: string;
    }>;
    sortColumn: keyof TableState['data'][0] | null;
    sortDirection: 'asc' | 'desc';
    filterText: string;
    selectedRows: Set<string>;
    currentPage: number;
    pageSize: number;
    setSort: (column: keyof TableState['data'][0]) => void;
    setFilter: (text: string) => void;
    toggleRowSelection: (id: string) => void;
    toggleAllSelection: () => void;
    setPage: (page: number) => void;
    getProcessedData: () => TableState['data'];
  };

  // Pre-generate table data outside benchmarks
  const tableData = Array.from({ length: 1000 }, (_, i) => ({
    id: `user-${i}`,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    role: ['Admin', 'User', 'Manager'][i % 3] || 'User',
    department: ['Sales', 'Engineering', 'Marketing', 'HR'][i % 4] || 'Sales',
    salary: 50000 + i * 1000,
    startDate: new Date(2020, 0, 1 + i).toISOString(),
  }));

  const setupStoreReact = () => {
    return renderHook(() =>
      useStore<TableState>((set, get) => ({
        data: tableData,
        sortColumn: null,
        sortDirection: 'asc',
        filterText: '',
        selectedRows: new Set(),
        currentPage: 0,
        pageSize: 50,
        setSort: (column) =>
          set({
            sortColumn: column,
            sortDirection:
              get().sortColumn === column && get().sortDirection === 'asc'
                ? 'desc'
                : 'asc',
          }),
        setFilter: (text) => set({ filterText: text, currentPage: 0 }),
        toggleRowSelection: (id) => {
          const selected = new Set(get().selectedRows);
          if (selected.has(id)) {
            selected.delete(id);
          } else {
            selected.add(id);
          }
          set({ selectedRows: selected });
        },
        toggleAllSelection: () => {
          const allIds = get().data.map((row) => row.id);
          const allSelected = allIds.every((id) => get().selectedRows.has(id));
          set({
            selectedRows: allSelected ? new Set() : new Set(allIds),
          });
        },
        setPage: (page) => set({ currentPage: page }),
        getProcessedData: () => {
          let filtered = get().data;
          const { filterText, sortColumn, sortDirection, currentPage, pageSize } = get();

          // Filter
          if (filterText) {
            filtered = filtered.filter((row) =>
              Object.values(row).some((val) =>
                String(val).toLowerCase().includes(filterText.toLowerCase())
              )
            );
          }

          // Sort
          if (sortColumn) {
            filtered = [...filtered].sort((a, b) => {
              const aVal = a[sortColumn];
              const bVal = b[sortColumn];
              const modifier = sortDirection === 'asc' ? 1 : -1;

              if (typeof aVal === 'string') {
                return aVal.localeCompare(bVal as string) * modifier;
              }
              return ((aVal as number) - (bVal as number)) * modifier;
            });
          }

          // Paginate
          const start = currentPage * pageSize;
          return filtered.slice(start, start + pageSize);
        },
      }))
    );
  };

  bench('@lattice/store-react - data table operations', () => {
    const { result } = setupStoreReact();

    // Measure ONLY the table operations
    act(() => {
      // Simulate user interactions
      result.current.setFilter('Engineering');
      result.current.getProcessedData();
      
      result.current.setSort('salary');
      result.current.getProcessedData();
      
      result.current.setSort('salary'); // Toggle direction
      result.current.getProcessedData();
      
      result.current.setFilter('');
      result.current.getProcessedData();

      // Select some rows
      const processedData = result.current.getProcessedData();
      processedData.slice(0, 10).forEach((row) => {
        result.current.toggleRowSelection(row.id);
      });

      // Navigate pages
      result.current.setPage(1);
      result.current.getProcessedData();
      result.current.setPage(2);
      result.current.getProcessedData();
      result.current.setPage(0);
      result.current.getProcessedData();
    });
  });

  const setupZustand = () => {
    const useTableStore = createZustand<TableState>((set, get) => ({
      data: tableData,
      sortColumn: null,
      sortDirection: 'asc',
      filterText: '',
      selectedRows: new Set(),
      currentPage: 0,
      pageSize: 50,
      setSort: (column) =>
        set((state) => ({
          sortColumn: column,
          sortDirection:
            state.sortColumn === column && state.sortDirection === 'asc'
              ? 'desc'
              : 'asc',
        })),
      setFilter: (text) => set({ filterText: text, currentPage: 0 }),
      toggleRowSelection: (id) =>
        set((state) => {
          const selected = new Set(state.selectedRows);
          if (selected.has(id)) {
            selected.delete(id);
          } else {
            selected.add(id);
          }
          return { selectedRows: selected };
        }),
      toggleAllSelection: () =>
        set((state) => {
          const allIds = state.data.map((row) => row.id);
          const allSelected = allIds.every((id) => state.selectedRows.has(id));
          return {
            selectedRows: allSelected ? new Set() : new Set(allIds),
          };
        }),
      setPage: (page) => set({ currentPage: page }),
      getProcessedData: () => {
        let filtered = get().data;
        const { filterText, sortColumn, sortDirection, currentPage, pageSize } = get();

        // Filter
        if (filterText) {
          filtered = filtered.filter((row) =>
            Object.values(row).some((val) =>
              String(val).toLowerCase().includes(filterText.toLowerCase())
            )
          );
        }

        // Sort
        if (sortColumn) {
          filtered = [...filtered].sort((a, b) => {
            const aVal = a[sortColumn];
            const bVal = b[sortColumn];
            const modifier = sortDirection === 'asc' ? 1 : -1;

            if (typeof aVal === 'string') {
              return aVal.localeCompare(bVal as string) * modifier;
            }
            return ((aVal as number) - (bVal as number)) * modifier;
          });
        }

        // Paginate
        const start = currentPage * pageSize;
        return filtered.slice(start, start + pageSize);
      },
    }));

    return renderHook(() => useTableStore());
  };

  bench('zustand - data table operations', () => {
    const { result } = setupZustand();

    // Measure ONLY the table operations
    act(() => {
      // Simulate user interactions
      result.current.setFilter('Engineering');
      result.current.getProcessedData();
      
      result.current.setSort('salary');
      result.current.getProcessedData();
      
      result.current.setSort('salary'); // Toggle direction
      result.current.getProcessedData();
      
      result.current.setFilter('');
      result.current.getProcessedData();

      // Select some rows
      const processedData = result.current.getProcessedData();
      processedData.slice(0, 10).forEach((row) => {
        result.current.toggleRowSelection(row.id);
      });

      // Navigate pages
      result.current.setPage(1);
      result.current.getProcessedData();
      result.current.setPage(2);
      result.current.getProcessedData();
      result.current.setPage(0);
      result.current.getProcessedData();
    });
  });
});