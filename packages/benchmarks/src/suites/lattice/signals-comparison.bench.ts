/**
 * Comprehensive Signals Library Comparison Benchmark
 *
 * Compares performance between:
 * 1. Preact signals (baseline)
 * 2. Lattice signals (current implementation)
 * 3. Alien signals (Vue 3 inspired push-pull algorithm)
 */

import { describe, bench } from 'vitest';
import {
  signal as preactSignal,
  computed as preactComputed,
  batch as preactBatch,
  effect as preactEffect,
} from '@preact/signals-core';
import {
  createSignalFactory,
  createComputedFactory,
  createBatchFactory,
  createEffectFactory,
  createSignalAPI,
} from '@lattice/signals';
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
  startBatch as alienStartBatch,
  endBatch as alienEndBatch,
} from 'alien-signals';

const ITERATIONS = 10000;

// Create Lattice API instance
const lattice = createSignalAPI({
  signal: createSignalFactory,
  computed: createComputedFactory,
  batch: createBatchFactory,
  effect: createEffectFactory,
});

describe('Single Signal Updates', () => {
  const preactCount = preactSignal(0);
  const latticeCount = lattice.signal(0);
  const alienCount = alienSignal(0);

  bench('Preact - single signal', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactCount.value = i;
      void preactCount.value; // Read
    }
  });

  bench('Lattice - single signal', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeCount.value = i;
      void latticeCount.value; // Read
    }
  });

  bench('Alien - single signal', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      alienCount(i);
      void alienCount(); // Read
    }
  });
});

describe('Computed Chain (a → b → c)', () => {
  // Preact
  const preactA = preactSignal(0);
  const preactB = preactComputed(() => preactA.value * 2);
  const preactC = preactComputed(() => preactB.value * 2);

  // Lattice
  const latticeA = lattice.signal(0);
  const latticeB = lattice.computed(() => latticeA.value * 2);
  const latticeC = lattice.computed(() => latticeB.value * 2);

  // Alien
  const alienA = alienSignal(0);
  const alienB = alienComputed(() => alienA() * 2);
  const alienC = alienComputed(() => alienB() * 2);

  bench('Preact - computed chain', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactA.value = i;
      void preactC.value; // Force evaluation
    }
  });

  bench('Lattice - computed chain', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeA.value = i;
      void latticeC.value; // Force evaluation
    }
  });

  bench('Alien - computed chain', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      alienA(i);
      void alienC(); // Force evaluation
    }
  });
});

describe('Deep Computed Tree', () => {
  // Preact setup
  const preactRoot = preactSignal(0);
  const preactA1 = preactComputed(() => preactRoot.value * 2);
  const preactA2 = preactComputed(() => preactRoot.value * 3);
  const preactB1 = preactComputed(() => preactA1.value + preactA2.value);
  const preactB2 = preactComputed(() => preactA1.value - preactA2.value);
  const preactC1 = preactComputed(() => preactB1.value * preactB2.value);
  const preactC2 = preactComputed(() => preactB1.value / (preactB2.value || 1));
  const preactResult = preactComputed(() => preactC1.value + preactC2.value);

  // Lattice setup
  const latticeRoot = lattice.signal(0);
  const latticeA1 = lattice.computed(() => latticeRoot.value * 2);
  const latticeA2 = lattice.computed(() => latticeRoot.value * 3);
  const latticeB1 = lattice.computed(() => latticeA1.value + latticeA2.value);
  const latticeB2 = lattice.computed(() => latticeA1.value - latticeA2.value);
  const latticeC1 = lattice.computed(() => latticeB1.value * latticeB2.value);
  const latticeC2 = lattice.computed(() => latticeB1.value / (latticeB2.value || 1));
  const latticeResult = lattice.computed(() => latticeC1.value + latticeC2.value);

  // Alien setup
  const alienRoot = alienSignal(0);
  const alienA1 = alienComputed(() => alienRoot() * 2);
  const alienA2 = alienComputed(() => alienRoot() * 3);
  const alienB1 = alienComputed(() => alienA1() + alienA2());
  const alienB2 = alienComputed(() => alienA1() - alienA2());
  const alienC1 = alienComputed(() => alienB1() * alienB2());
  const alienC2 = alienComputed(() => alienB1() / (alienB2() || 1));
  const alienResult = alienComputed(() => alienC1() + alienC2());

  bench('Preact - deep tree', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactRoot.value = i + 1; // Avoid divide by zero
      void preactResult.value;
    }
  });

  bench('Lattice - deep tree', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeRoot.value = i + 1; // Avoid divide by zero
      void latticeResult.value;
    }
  });

  bench('Alien - deep tree', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      alienRoot(i + 1); // Avoid divide by zero
      void alienResult();
    }
  });
});

describe('Diamond Pattern', () => {
  // Preact
  const preactSource = preactSignal(0);
  const preactLeft = preactComputed(() => preactSource.value * 2);
  const preactRight = preactComputed(() => preactSource.value * 3);
  const preactBottom = preactComputed(() => preactLeft.value + preactRight.value);

  // Lattice
  const latticeSource = lattice.signal(0);
  const latticeLeft = lattice.computed(() => latticeSource.value * 2);
  const latticeRight = lattice.computed(() => latticeSource.value * 3);
  const latticeBottom = lattice.computed(() => latticeLeft.value + latticeRight.value);

  // Alien
  const alienSource = alienSignal(0);
  const alienLeft = alienComputed(() => alienSource() * 2);
  const alienRight = alienComputed(() => alienSource() * 3);
  const alienBottom = alienComputed(() => alienLeft() + alienRight());

  bench('Preact - diamond', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactSource.value = i;
      void preactBottom.value;
    }
  });

  bench('Lattice - diamond', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeSource.value = i;
      void latticeBottom.value;
    }
  });

  bench('Alien - diamond', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      alienSource(i);
      void alienBottom();
    }
  });
});

describe('Batch Updates', () => {
  // Preact
  const preactS1 = preactSignal(0);
  const preactS2 = preactSignal(0);
  const preactS3 = preactSignal(0);
  const preactSum = preactComputed(() => preactS1.value + preactS2.value + preactS3.value);

  // Lattice
  const latticeS1 = lattice.signal(0);
  const latticeS2 = lattice.signal(0);
  const latticeS3 = lattice.signal(0);
  const latticeSum = lattice.computed(() => latticeS1.value + latticeS2.value + latticeS3.value);

  // Alien
  const alienS1 = alienSignal(0);
  const alienS2 = alienSignal(0);
  const alienS3 = alienSignal(0);
  const alienSum = alienComputed(() => alienS1() + alienS2() + alienS3());

  bench('Preact - batch updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactBatch(() => {
        preactS1.value = i;
        preactS2.value = i * 2;
        preactS3.value = i * 3;
      });
      void preactSum.value;
    }
  });

  bench('Lattice - batch updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      lattice.batch(() => {
        latticeS1.value = i;
        latticeS2.value = i * 2;
        latticeS3.value = i * 3;
      });
      void latticeSum.value;
    }
  });

  bench('Alien - batch updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      alienStartBatch();
      alienS1(i);
      alienS2(i * 2);
      alienS3(i * 3);
      alienEndBatch();
      void alienSum();
    }
  });
});

describe('Large Dependency Graph', () => {
  // Preact
  const preactSignals = Array.from({ length: 10 }, (_, i) => preactSignal(i));
  const preactComputeds = preactSignals.map((s, i) =>
    preactComputed(() => {
      let sum = s.value;
      // Each computed depends on 3 signals
      if (i > 0) sum += preactSignals[i - 1]!.value;
      if (i < preactSignals.length - 1) sum += preactSignals[i + 1]!.value;
      if (i > 1) sum += preactSignals[i - 2]!.value;
      return sum;
    })
  );

  // Lattice
  const latticeSignals = Array.from({ length: 10 }, (_, i) => lattice.signal(i));
  const latticeComputeds = latticeSignals.map((s, i) =>
    lattice.computed(() => {
      let sum = s.value;
      // Each computed depends on 3 signals
      if (i > 0) sum += latticeSignals[i - 1]!.value;
      if (i < latticeSignals.length - 1) sum += latticeSignals[i + 1]!.value;
      if (i > 1) sum += latticeSignals[i - 2]!.value;
      return sum;
    })
  );

  // Alien
  const alienSignals = Array.from({ length: 10 }, (_, i) => alienSignal(i));
  const alienComputeds = alienSignals.map((s, i) =>
    alienComputed(() => {
      let sum = s();
      // Each computed depends on 3 signals
      if (i > 0) sum += alienSignals[i - 1]!();
      if (i < alienSignals.length - 1) sum += alienSignals[i + 1]!();
      if (i > 1) sum += alienSignals[i - 2]!();
      return sum;
    })
  );

  bench('Preact - large graph', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactSignals[i % preactSignals.length]!.value = i;
      // Sample a few computeds
      void preactComputeds[0]!.value;
      void preactComputeds[5]!.value;
      void preactComputeds[9]!.value;
    }
  });

  bench('Lattice - large graph', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeSignals[i % latticeSignals.length]!.value = i;
      // Sample a few computeds
      void latticeComputeds[0]!.value;
      void latticeComputeds[5]!.value;
      void latticeComputeds[9]!.value;
    }
  });

  bench('Alien - large graph', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      alienSignals[i % alienSignals.length]!(i);
      // Sample a few computeds
      void alienComputeds[0]!();
      void alienComputeds[5]!();
      void alienComputeds[9]!();
    }
  });
});

describe('Rapid Updates Without Reads', () => {
  // Preact
  const preactSig = preactSignal(0);
  const preactComp = preactComputed(() => preactSig.value * 2);

  // Lattice
  const latticeSig = lattice.signal(0);
  const latticeComp = lattice.computed(() => latticeSig.value * 2);

  // Alien
  const alienSig = alienSignal(0);
  const alienComp = alienComputed(() => alienSig() * 2);

  bench('Preact - rapid updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactSig.value = i;
    }
    // Only read once at the end
    void preactComp.value;
  });

  bench('Lattice - rapid updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeSig.value = i;
    }
    // Only read once at the end
    void latticeComp.value;
  });

  bench('Alien - rapid updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      alienSig(i);
    }
    // Only read once at the end
    void alienComp();
  });
});

describe('Read-heavy Workload', () => {
  // Preact
  const preactReadSignal = preactSignal(0);
  const preactReadComputed1 = preactComputed(() => preactReadSignal.value * 2);
  const preactReadComputed2 = preactComputed(() => preactReadSignal.value * 3);

  // Lattice
  const latticeReadSignal = lattice.signal(0);
  const latticeReadComputed1 = lattice.computed(() => latticeReadSignal.value * 2);
  const latticeReadComputed2 = lattice.computed(() => latticeReadSignal.value * 3);

  // Alien
  const alienReadSignal = alienSignal(0);
  const alienReadComputed1 = alienComputed(() => alienReadSignal() * 2);
  const alienReadComputed2 = alienComputed(() => alienReadSignal() * 3);

  bench('Preact - many reads', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      void preactReadSignal.value;
      void preactReadComputed1.value;
      void preactReadComputed2.value;
      void preactReadSignal.value;
      void preactReadComputed1.value;
    }
  });

  bench('Lattice - many reads', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      void latticeReadSignal.value;
      void latticeReadComputed1.value;
      void latticeReadComputed2.value;
      void latticeReadSignal.value;
      void latticeReadComputed1.value;
    }
  });

  bench('Alien - many reads', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      void alienReadSignal();
      void alienReadComputed1();
      void alienReadComputed2();
      void alienReadSignal();
      void alienReadComputed1();
    }
  });
});

describe('Effect Performance', () => {
  // Preact
  const preactEffectSignal = preactSignal(0);
  const preactCleanup = preactEffect(() => {
    void preactEffectSignal.value;
  });

  // Lattice
  const latticeEffectSignal = lattice.signal(0);
  const latticeCleanup = lattice.effect(() => {
    void latticeEffectSignal.value;
  });

  // Alien
  const alienEffectSignal = alienSignal(0);
  const alienCleanup = alienEffect(() => {
    void alienEffectSignal();
  });

  bench('Preact - effect triggers', () => {
    for (let i = 0; i < 1000; i++) {
      preactEffectSignal.value = i;
    }
  });

  bench('Lattice - effect triggers', () => {
    for (let i = 0; i < 1000; i++) {
      latticeEffectSignal.value = i;
    }
  });

  bench('Alien - effect triggers', () => {
    for (let i = 0; i < 1000; i++) {
      alienEffectSignal(i);
    }
  });

  // Cleanup
  preactCleanup();
  latticeCleanup();
  alienCleanup();
});