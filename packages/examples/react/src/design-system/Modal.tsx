/**
 * Modal Design System Component
 *
 * Demonstrates isolated component state using portable behaviors.
 * Each Modal instance has its own signal instances (isolated state),
 * but shares the reactive infrastructure (shared graph).
 *
 * This is similar to how React's useState works - each component instance
 * gets its own state, but all use the same React reconciliation system.
 */

import { ReactNode } from 'react';
import { createHook, useSubscribe } from '@lattice/react';
import { modal } from '../behaviors/modal';

// Create React hook from portable behavior (once at module level)
const useModal = createHook(modal);

export type ModalProps = {
  title: string;
  children: ReactNode;
  trigger?: ReactNode;
};

export function Modal({ title, children, trigger }: ModalProps) {
  const modal = useModal();
  const isOpen = useSubscribe(modal.isOpen);

  return (
    <>
      {trigger ? (
        <div onClick={() => modal.open()}>{trigger}</div>
      ) : (
        <button onClick={() => modal.open()}>Open {title}</button>
      )}

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
