import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createModel } from '../model';
import { withStoreSubscribe } from '../state';

describe('Event Handling in Actions', () => {
  it('handles DOM events in action methods', () => {
    // Create a test store for a form
    interface FormState {
      name: string;
      email: string;
      agreeToTerms: boolean;
      submitted: boolean;
    }

    const formStore = create<FormState>(() => ({
      name: '',
      email: '',
      agreeToTerms: false,
      submitted: false,
    }));

    // Create a subscriber
    const subscriber = withStoreSubscribe(formStore, (state) => state);

    // Create model with methods for form handling
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      getName: () => selectedState.name,
      getEmail: () => selectedState.email,
      getAgreeToTerms: () => selectedState.agreeToTerms,
      isSubmitted: () => selectedState.submitted,

      setName: (name: string) => {
        formStore.setState({ name });
      },

      setEmail: (email: string) => {
        formStore.setState({ email });
      },

      setAgreeToTerms: (agree: boolean) => {
        formStore.setState({ agreeToTerms: agree });
      },

      submit: () => {
        formStore.setState({ submitted: true });
      },

      reset: () => {
        formStore.setState({
          name: '',
          email: '',
          agreeToTerms: false,
          submitted: false,
        });
      },
    }));

    // Spy on model methods
    const setNameSpy = vi.spyOn(model, 'setName');
    const setEmailSpy = vi.spyOn(model, 'setEmail');
    const setAgreeToTermsSpy = vi.spyOn(model, 'setAgreeToTerms');
    const submitSpy = vi.spyOn(model, 'submit');

    // Create actions that handle DOM events
    const actions = {
      // Input change handler
      handleInputChange: (e: { target: { name: string; value: string } }) => {
        const { name, value } = e.target;

        if (name === 'name') {
          model.setName(value);
        } else if (name === 'email') {
          model.setEmail(value);
        }
      },

      // Checkbox change handler
      handleCheckboxChange: (e: { target: { checked: boolean } }) => {
        model.setAgreeToTerms(e.target.checked);
      },

      // Form submit handler
      handleSubmit: (e: { preventDefault: () => void }) => {
        // Prevent default form submission
        e.preventDefault();

        // Only submit if terms are agreed to
        if (model.getAgreeToTerms()) {
          model.submit();
          return true;
        }
        return false;
      },

      // Reset form handler
      handleReset: (e: { preventDefault: () => void }) => {
        e.preventDefault();
        model.reset();
      },
    };

    // Test initial state
    expect(model.getName()).toBe('');
    expect(model.getEmail()).toBe('');
    expect(model.getAgreeToTerms()).toBe(false);
    expect(model.isSubmitted()).toBe(false);

    // Test name input change event
    const nameChangeEvent = {
      target: {
        name: 'name',
        value: 'John Doe',
      },
    };

    actions.handleInputChange(nameChangeEvent);
    expect(setNameSpy).toHaveBeenCalledWith('John Doe');
    expect(model.getName()).toBe('John Doe');

    // Test email input change event
    const emailChangeEvent = {
      target: {
        name: 'email',
        value: 'john.doe@example.com',
      },
    };

    actions.handleInputChange(emailChangeEvent);
    expect(setEmailSpy).toHaveBeenCalledWith('john.doe@example.com');
    expect(model.getEmail()).toBe('john.doe@example.com');

    // Test checkbox change event
    const checkboxChangeEvent = {
      target: {
        checked: true,
      },
    };

    actions.handleCheckboxChange(checkboxChangeEvent);
    expect(setAgreeToTermsSpy).toHaveBeenCalledWith(true);
    expect(model.getAgreeToTerms()).toBe(true);

    // Test form submit event
    const submitEvent = {
      preventDefault: vi.fn(),
    };

    // Should submit successfully because terms are agreed to
    const submitResult = actions.handleSubmit(submitEvent);
    expect(submitEvent.preventDefault).toHaveBeenCalled();
    expect(submitSpy).toHaveBeenCalled();
    expect(submitResult).toBe(true);
    expect(model.isSubmitted()).toBe(true);

    // Test form reset event
    const resetEvent = {
      preventDefault: vi.fn(),
    };

    actions.handleReset(resetEvent);
    expect(resetEvent.preventDefault).toHaveBeenCalled();
    expect(model.getName()).toBe('');
    expect(model.getEmail()).toBe('');
    expect(model.getAgreeToTerms()).toBe(false);
    expect(model.isSubmitted()).toBe(false);
  });

  it('handles complex event objects with nested properties', () => {
    // Create a test store for a drag and drop interface
    interface DragState {
      isDragging: boolean;
      draggedItemId: string | null;
      dragPosition: { x: number; y: number } | null;
    }

    const dragStore = create<DragState>(() => ({
      isDragging: false,
      draggedItemId: null,
      dragPosition: null,
    }));

    // Create a subscriber
    const subscriber = withStoreSubscribe(dragStore, (state) => state);

    // Create model with methods for drag handling
    const { model } = createModel(subscriber)((_set, _get, selectedState) => ({
      isDragging: () => selectedState.isDragging,
      getDraggedItemId: () => selectedState.draggedItemId,
      getDragPosition: () => selectedState.dragPosition,

      startDrag: (itemId: string, position: { x: number; y: number }) => {
        dragStore.setState({
          isDragging: true,
          draggedItemId: itemId,
          dragPosition: position,
        });
      },

      updateDragPosition: (position: { x: number; y: number }) => {
        dragStore.setState({
          dragPosition: position,
        });
      },

      endDrag: () => {
        dragStore.setState({
          isDragging: false,
          draggedItemId: null,
          dragPosition: null,
        });
      },
    }));

    // Spy on model methods
    const startDragSpy = vi.spyOn(model, 'startDrag');
    const updateDragPositionSpy = vi.spyOn(model, 'updateDragPosition');
    const endDragSpy = vi.spyOn(model, 'endDrag');

    // Create actions that handle complex drag events
    const actions = {
      // Handle drag start event
      handleDragStart: (e: {
        target: { dataset: { id: string } };
        clientX: number;
        clientY: number;
        preventDefault: () => void;
      }) => {
        e.preventDefault();
        const itemId = e.target.dataset.id;
        const position = { x: e.clientX, y: e.clientY };

        model.startDrag(itemId, position);
      },

      // Handle drag move event
      handleDragMove: (e: {
        clientX: number;
        clientY: number;
        preventDefault: () => void;
      }) => {
        e.preventDefault();

        if (model.isDragging()) {
          const position = { x: e.clientX, y: e.clientY };
          model.updateDragPosition(position);
        }
      },

      // Handle drag end event
      handleDragEnd: (e: { preventDefault: () => void }) => {
        e.preventDefault();
        model.endDrag();
      },
    };

    // Test initial state
    expect(model.isDragging()).toBe(false);
    expect(model.getDraggedItemId()).toBe(null);
    expect(model.getDragPosition()).toBe(null);

    // Test drag start event
    const dragStartEvent = {
      target: {
        dataset: {
          id: 'item-1',
        },
      },
      clientX: 100,
      clientY: 200,
      preventDefault: vi.fn(),
    };

    actions.handleDragStart(dragStartEvent);
    expect(dragStartEvent.preventDefault).toHaveBeenCalled();
    expect(startDragSpy).toHaveBeenCalledWith('item-1', { x: 100, y: 200 });
    expect(model.isDragging()).toBe(true);
    expect(model.getDraggedItemId()).toBe('item-1');
    expect(model.getDragPosition()).toEqual({ x: 100, y: 200 });

    // Test drag move event
    const dragMoveEvent = {
      clientX: 150,
      clientY: 250,
      preventDefault: vi.fn(),
    };

    actions.handleDragMove(dragMoveEvent);
    expect(dragMoveEvent.preventDefault).toHaveBeenCalled();
    expect(updateDragPositionSpy).toHaveBeenCalledWith({ x: 150, y: 250 });
    expect(model.getDragPosition()).toEqual({ x: 150, y: 250 });

    // Test drag end event
    const dragEndEvent = {
      preventDefault: vi.fn(),
    };

    actions.handleDragEnd(dragEndEvent);
    expect(dragEndEvent.preventDefault).toHaveBeenCalled();
    expect(endDragSpy).toHaveBeenCalled();
    expect(model.isDragging()).toBe(false);
    expect(model.getDraggedItemId()).toBe(null);
    expect(model.getDragPosition()).toBe(null);
  });
});
