/**
 * Modal Design System Component
 *
 * Demonstrates isolated component state using the parent SignalProvider.
 * Each Modal instance has its own signal instances (isolated state),
 * but shares the reactive infrastructure (shared graph).
 *
 * This is similar to how React's useState works - each component instance
 * gets its own state, but all use the same React reconciliation system.
 */

import { ReactNode } from 'react';
import { useComponent, useSubscribe } from '@lattice/react';
import { useModal } from '../components/useModal';

export interface ModalProps {
  title: string;
  children: ReactNode;
  trigger?: ReactNode;
}

/**
 * Modal Component - Isolated state, shared infrastructure
 *
 * Each Modal instance creates its own signal instance via useComponent,
 * giving it isolated state. But all Modals share the parent SignalProvider's
 * reactive graph infrastructure (SignalsContext, scheduler, propagation).
 *
 * Usage:
 * ```tsx
 * <Modal title="Settings">
 *   <p>Modal content here</p>
 * </Modal>
 * ```
 */
export function Modal({ title, children, trigger }: ModalProps) {
  // useComponent gets API from parent SignalProvider
  // Each call creates a new signal instance (isolated state)
  const modal = useComponent(useModal);
  const isOpen = useSubscribe(modal.isOpen);

  return (
    <>
      {/* Trigger button */}
      {trigger ? (
        <div onClick={() => modal.open()}>{trigger}</div>
      ) : (
        <button onClick={() => modal.open()}>Open {title}</button>
      )}

      {/* Modal overlay and content */}
      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => modal.close()}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <h2 style={{ margin: 0 }}>{title}</h2>
                <button
                  onClick={() => modal.close()}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                  }}
                >
                  ×
                </button>
              </div>
              <div>{children}</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
