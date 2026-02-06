/**
 * Integration test for load() + match() SSR marker positioning
 *
 * This test verifies the fix for a hydration mismatch bug:
 *
 * During SSR, when load() wraps a match() that switches between pending/ready states:
 * 1. Initially, match() renders the "pending" content (e.g., Loading...)
 * 2. renderToStringAsync resolves the async fragment
 * 3. The "ready" content replaces the pending content
 * 4. Markers are inserted AFTER resolution, around the final content
 *
 * Expected: <!--fragment-start--><div class="ready">...</div><!--fragment-end-->
 *           (with data available via loader.getData())
 *
 * The bug was markers being inserted early, around the pending content.
 */

import { describe, it, expect } from 'vitest';
import { compose } from '@rimitive/core';
import {
  SignalModule,
  ComputedModule,
  EffectModule,
  BatchModule,
} from '@rimitive/signals/extend';
import { ElModule } from '@rimitive/view/el';
import { MatchModule } from '@rimitive/view/match';
import { createLoader } from '@rimitive/view/load';
import type { LoadState, LoadStatus } from '@rimitive/view/load';
import type { RefSpec } from '@rimitive/view/types';
import { createParse5Adapter, renderToStringAsync } from './server/index';

/**
 * Create a service composition for SSR testing
 * Returns service, adapter, serialize, insertFragmentMarkers, and getLoaderData function
 */
function createTestService() {
  const { adapter, serialize, insertFragmentMarkers } =
    createParse5Adapter();

  const baseSvc = compose(
    SignalModule,
    ComputedModule,
    EffectModule,
    BatchModule,
    ElModule.with({ adapter }),
    MatchModule.with({ adapter })
  );

  const loader = createLoader({ signal: baseSvc.signal });

  return {
    service: { ...baseSvc, load: loader.load },
    adapter,
    serialize,
    insertFragmentMarkers,
    getLoaderData: loader.getData,
  } as const;
}

describe('load() SSR fragment marker positioning', () => {
  /**
   * Tests async fragment marker positioning with new createLoader API.
   *
   * With createLoader:
   * - Markers are now just <!--fragment-start--> without embedded data
   * - Data is collected separately via loader.getData()
   * - load() calls require an ID as the first parameter
   *
   * The test verifies:
   * 1. Markers exist and wrap the rendered content
   * 2. No data is embedded in markers (no colon)
   * 3. Data is available via getLoaderData()
   */
  it('should collect data via loader.getData() for async fragments', async () => {
    const {
      service: svc,
      serialize,
      insertFragmentMarkers,
      getLoaderData,
    } = createTestService();
    const { el, load, match } = svc;

    // Simulate the Stats page pattern: load() wrapping match(status)
    const testData = { value: 42, name: 'test' };

    const appSpec = el('div').props({ className: 'container' })(
      load(
        'test-fragment',
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
      serialize,
      insertFragmentMarkers,
    });

    // Markers should NOT contain embedded data anymore
    expect(html).toContain('<!--fragment-start-->');
    expect(html).not.toContain('fragment-start:');

    // The ready content should be present (not loading)
    expect(html).toContain('class="ready"');
    expect(html).toContain('Value: 42');
    expect(html).not.toContain('class="loading"');
    expect(html).not.toContain('Loading...');

    // Data should be available via getLoaderData()
    const loaderData = getLoaderData();
    expect(loaderData['test-fragment']).toEqual(testData);
  });

  it('should position markers around the actual content, not the initial pending state', async () => {
    const {
      service: svc,
      serialize,
      insertFragmentMarkers,
      getLoaderData,
    } = createTestService();
    const { el, load, match } = svc;

    const testData = { message: 'Hello World' };

    const appSpec = el('main')(
      load(
        'message-fragment',
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
      serialize,
      insertFragmentMarkers,
    });

    // Extract the main content to analyze marker positioning
    const mainMatch = html.match(/<main>([\s\S]*)<\/main>/);
    expect(mainMatch).not.toBeNull();
    const mainContent = mainMatch![1];

    // The markers should wrap the ready content (the <p>), not be empty
    // CORRECT: <!--fragment-start--> ... <p>...</p> ... <!--fragment-end-->
    // WRONG:   <!--fragment-start--><!--fragment-end--><p>...</p>

    // Check that fragment-start comes before the actual content
    const fragmentStartIndex = mainContent!.indexOf('fragment-start');
    const pTagIndex = mainContent!.indexOf('<p');
    const fragmentEndIndex = mainContent!.indexOf('fragment-end');

    expect(fragmentStartIndex).toBeGreaterThanOrEqual(0);
    expect(pTagIndex).toBeGreaterThan(fragmentStartIndex);
    expect(fragmentEndIndex).toBeGreaterThan(pTagIndex);

    // Verify data is NOT embedded in markers
    expect(mainContent).not.toContain('fragment-start:');

    // Verify no empty marker pairs (the bug symptom)
    expect(mainContent).not.toMatch(/<!--fragment-start--><!--fragment-end-->/);

    // Data should be available via getLoaderData()
    const loaderData = getLoaderData();
    expect(loaderData['message-fragment']).toEqual(testData);
  });

  it('should handle nested load() correctly', async () => {
    const {
      service: svc,
      serialize,
      insertFragmentMarkers,
      getLoaderData,
    } = createTestService();
    const { el, load, match } = svc;

    const outerData = { outer: true };
    const innerData = { inner: true };

    const appSpec = el('div')(
      load(
        'outer-fragment',
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
                'inner-fragment',
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
      serialize,
      insertFragmentMarkers,
    });

    // Both should be resolved
    expect(html).toContain('class="inner-ready"');
    expect(html).not.toContain('loading');

    // Both should have markers (without embedded data)
    const markerCount = (html.match(/<!--fragment-start-->/g) || []).length;
    expect(markerCount).toBe(2); // outer and inner async fragments

    // Both should NOT have data embedded in markers
    expect(html).not.toContain('fragment-start:');

    // Both should have data available via getLoaderData()
    const loaderData = getLoaderData();
    expect(loaderData['outer-fragment']).toEqual(outerData);
    expect(loaderData['inner-fragment']).toEqual(innerData);
  });
});
