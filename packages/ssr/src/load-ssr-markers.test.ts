/**
 * Integration test for load() + match() SSR marker positioning
 *
 * This test verifies the root cause of a hydration mismatch bug:
 *
 * During SSR, when load() wraps a match() that switches between pending/ready states:
 * 1. Initially, match() renders the "pending" content (e.g., Loading...)
 * 2. The SSR adapter's onAttach inserts fragment markers around the pending content
 * 3. Later, resolve() updates status to 'ready', causing match() to re-render
 * 4. The "ready" content (e.g., actual data) replaces the pending content
 * 5. BUT the markers stay in their original position (around where pending content was)
 * 6. The final HTML has markers in the wrong place, causing hydration mismatch
 *
 * Expected: <!--fragment-start:DATA--><div class="ready">...</div><!--fragment-end-->
 * Actual:   <!--fragment-start--><!--fragment-end--><div class="ready">...</div>
 */

import { describe, it, expect } from 'vitest';
import { compose } from '@lattice/lattice';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@lattice/signals/extend';
import { createElModule } from '@lattice/view/el';
import { createMatchModule } from '@lattice/view/match';
import { LoadModule } from '@lattice/view/load';
import type { LoadState, LoadStatus } from '@lattice/view/load';
import type { RefSpec } from '@lattice/view/types';
import { createDOMServerAdapter, renderToStringAsync } from './server/index';

/**
 * Create a service composition for SSR testing
 * Returns both the service and adapter (needed for renderToStringAsync)
 */
function createTestService() {
  const adapter = createDOMServerAdapter();

  const service = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    createElModule(adapter),
    createMatchModule(adapter),
    LoadModule
  )();

  return { service, adapter } as const;
}

describe('load() SSR fragment marker positioning', () => {
  /**
   * This test demonstrates the hydration mismatch bug.
   *
   * The actual output is:
   *   <div class="container"><!--fragment-start--><!--fragment-end--><div class="ready">Value: 42</div></div>
   *
   * The expected output should be:
   *   <div class="container"><!--fragment-start:BASE64DATA--><div class="ready">Value: 42</div><!--fragment-end--></div>
   *
   * The bug: Markers are inserted around initial pending content, then when resolve()
   * updates status to 'ready', the content changes but markers stay in their original position.
   */
  it('should embed data in fragment-start marker for async fragments', async () => {
    const { service: svc, adapter } = createTestService();
    const { el, load, match } = svc;

    // Simulate the Stats page pattern: load() wrapping match(status)
    const testData = { value: 42, name: 'test' };

    const appSpec = el('div').props({ className: 'container' })(
      load(
        async () => testData,
        (state: LoadState<typeof testData>) =>
          match(state.status, (status: LoadStatus) => {
            switch (status) {
              case 'pending':
                return el('div').props({ className: 'loading' })('Loading...');
              case 'error':
                return el('div').props({ className: 'error' })('Error!');
              case 'ready':
                return el('div').props({ className: 'ready' })(
                  `Value: ${state.data()?.value}`
                );
            }
          })
      )
    );

    const html = await renderToStringAsync(appSpec, {
      svc,
      mount: (spec: RefSpec<unknown>) => spec.create(svc),
      adapter,
    });

    // The fragment markers should contain base64-encoded data
    expect(html).toContain('fragment-start:');

    // The ready content should be present (not loading)
    expect(html).toContain('class="ready"');
    expect(html).toContain('Value: 42');
    expect(html).not.toContain('class="loading"');
    expect(html).not.toContain('Loading...');
  });

  it(
    'should position markers around the actual content, not the initial pending state',
    async () => {
      const { service: svc, adapter } = createTestService();
      const { el, load, match } = svc;

      const testData = { message: 'Hello World' };

      const appSpec = el('main')(
        load(
          async () => testData,
          (state: LoadState<typeof testData>) =>
            match(state.status, (status: LoadStatus) => {
              switch (status) {
                case 'pending':
                  return el('span').props({ className: 'pending' })('...');
                case 'error':
                  return el('span').props({ className: 'error' })('!');
                case 'ready':
                  return el('p').props({ className: 'content' })(
                    state.data()?.message ?? ''
                  );
              }
            })
        )
      );

      const html = await renderToStringAsync(appSpec, {
        svc,
        mount: (spec: RefSpec<unknown>) => spec.create(svc),
        adapter,
      });

      // Extract the main content to analyze marker positioning
      const mainMatch = html.match(/<main>([\s\S]*)<\/main>/);
      expect(mainMatch).not.toBeNull();
      const mainContent = mainMatch![1];

      // The markers should wrap the ready content (the <p>), not be empty
      // CORRECT: <!--fragment-start:...--> ... <p>...</p> ... <!--fragment-end-->
      // WRONG:   <!--fragment-start--><!--fragment-end--><p>...</p>

      // Check that fragment-start comes before the actual content
      const fragmentStartIndex = mainContent!.indexOf('fragment-start');
      const pTagIndex = mainContent!.indexOf('<p');
      const fragmentEndIndex = mainContent!.indexOf('fragment-end');

      expect(fragmentStartIndex).toBeGreaterThanOrEqual(0);
      expect(pTagIndex).toBeGreaterThan(fragmentStartIndex);
      expect(fragmentEndIndex).toBeGreaterThan(pTagIndex);

      // Verify data is embedded
      expect(mainContent).toContain('fragment-start:');

      // Verify no empty marker pairs (the bug symptom)
      expect(mainContent).not.toMatch(
        /<!--fragment-start[^:>]*--><!--fragment-end-->/
      );
    }
  );

  it('should handle nested load() correctly', async () => {
    const { service: svc, adapter } = createTestService();
    const { el, load, match } = svc;

    const outerData = { outer: true };
    const innerData = { inner: true };

    const appSpec = el('div')(
      load(
        async () => outerData,
        (outerState: LoadState<typeof outerData>) =>
          match(outerState.status, (status: LoadStatus) => {
            if (status !== 'ready') {
              return el('div').props({ className: 'outer-loading' })(
                'Outer loading...'
              );
            }
            // Nested load inside the ready state
            return el('section')(
              load(
                async () => innerData,
                (innerState: LoadState<typeof innerData>) =>
                  match(innerState.status, (innerStatus: LoadStatus) => {
                    if (innerStatus !== 'ready') {
                      return el('div').props({ className: 'inner-loading' })(
                        'Inner loading...'
                      );
                    }
                    return el('div').props({ className: 'inner-ready' })(
                      'Inner ready'
                    );
                  })
              )
            );
          })
      )
    );

    const html = await renderToStringAsync(appSpec, {
      svc,
      mount: (spec: RefSpec<unknown>) => spec.create(svc),
      adapter,
    });

    // Both should be resolved
    expect(html).toContain('class="inner-ready"');
    expect(html).not.toContain('loading');

    // Both should have data markers
    const markerCount = (html.match(/fragment-start:/g) || []).length;
    expect(markerCount).toBe(2); // outer and inner async fragments
  });
});
