/**
 * Modal Design System Component
 *
 * Demonstrates the encapsulated signal context pattern.
 * Each Modal instance has its own SignalProvider, completely isolated
 * from other modals and the rest of the app.
 *
 * This is similar to how Chakra UI components manage their internal state.
 */

import React, { ReactNode } from 'react';
import { SignalProvider, useComponent, useSubscribe } from '@lattice/react';
import { createApi } from '@lattice/lattice';
import { createSignalFactory, SignalOpts } from '@lattice/signals/signal';
import { ComputedOpts, createComputedFactory } from '@lattice/signals/computed';
import { createEffectFactory, EffectOpts } from '@lattice/signals/effect';
import { BatchOpts, createBatchFactory } from '@lattice/signals/batch';
import { createBaseContext } from '@lattice/signals/context';
import { createGraphEdges } from '@lattice/signals/helpers/graph-edges';
import { createScheduler } from '@lattice/signals/helpers/scheduler';
import { createPullPropagator } from '@lattice/signals/helpers/pull-propagator';
import { instrumentSignal } from '@lattice/signals/devtools/signal';
import { instrumentComputed } from '@lattice/signals/devtools/computed';
import { instrumentEffect } from '@lattice/signals/devtools/effect';
import { instrumentBatch } from '@lattice/signals/devtools/batch';
import { devtoolsProvider, createInstrumentation } from '@lattice/lattice';
import { createModal } from '../components/modal';
import { createGraphTraversal } from '@lattice/signals/helpers/graph-traversal';

// Helper to create a signal API for a component instance
function createComponentSignalAPI() {
  const ctx = createBaseContext();
  const { trackDependency, detachAll, track } = createGraphEdges({ ctx });
  const { withVisitor } = createGraphTraversal();
  const { withPropagate, dispose, startBatch, endBatch } = createScheduler({ detachAll });
  const { pullUpdates, shallowPropagate } = createPullPropagator({ track });

  const instrumentation = createInstrumentation({
    enabled: true,
    providers: [devtoolsProvider({ debug: false })],
  });

  return createApi(
    {
      signal: (opts: SignalOpts) =>
        createSignalFactory({ ...opts, instrument: instrumentSignal }),
      computed: (opts: ComputedOpts) =>
        createComputedFactory({ ...opts, instrument: instrumentComputed }),
      effect: (opts: EffectOpts) =>
        createEffectFactory({ ...opts, instrument: instrumentEffect }),
      batch: (opts: BatchOpts) =>
        createBatchFactory({ ...opts, instrument: instrumentBatch }),
    },
    {
      ctx,
      trackDependency,
      propagate: withPropagate(withVisitor),
      track,
      dispose,
      pullUpdates,
      shallowPropagate,
      startBatch,
      endBatch,
      instrumentation,
    }
  );
}

export interface ModalProps {
  title: string;
  children: ReactNode;
  trigger?: ReactNode;
}

/**
 * Modal Component - Each instance has its own signal context
 *
 * Usage:
 * ```tsx
 * <Modal title="Settings">
 *   <p>Modal content here</p>
 * </Modal>
 * ```
 */
export function Modal({ title, children, trigger }: ModalProps) {
  // Each Modal creates its own SignalProvider!
  const api = React.useMemo(() => createComponentSignalAPI(), []);

  return (
    <SignalProvider api={api}>
      <ModalContent title={title} trigger={trigger}>
        {children}
      </ModalContent>
    </SignalProvider>
  );
}

// Internal component that uses the encapsulated signal context
function ModalContent({ title, children, trigger }: ModalProps) {
  const modal = useComponent(createModal);
  const isOpen = useSubscribe(modal.isOpen);

  return (
    <>
      {/* Trigger button */}
      {trigger ? (
        <div onClick={modal.open}>{trigger}</div>
      ) : (
        <button onClick={modal.open}>Open {title}</button>
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
            onClick={modal.close}
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
                  onClick={modal.close}
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
