/**
 * Preact vs Lattice Optimized Implementations Benchmark
 *
 * Compares performance between:
 * 1. Preact signals (baseline)
 * 2. Lattice current implementation
 * 4. Lattice class-based optimized implementation
 */

import { describe, bench } from 'vitest';
import {
  signal as preactSignal,
  computed as preactComputed,
  batch as preactBatch,
} from '@preact/signals-core';
import {
  signal as latticeSignal,
  computed as latticeComputed,
  batch as latticeBatch,
} from '@lattice/signals';
import { createSignalAPI } from '@lattice/signals';

const ITERATIONS = 10000;

const classOptimized = createSignalAPI();

describe('Single Signal Updates', () => {
  const preactCount = preactSignal(0);
  const latticeCount = latticeSignal(0);
  const classOptimizedCount = classOptimized.signal(0);

  bench('Preact - single signal', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactCount.value = i;
      void preactCount.value; // Read
    }
  });

  bench('Lattice (default global) - single signal', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeCount.value = i;
      void latticeCount.value; // Read
    }
  });

  bench('Lattice (scoped) - single signal', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      classOptimizedCount.value = i;
      void classOptimizedCount.value; // Read
    }
  });
});

describe('Computed Chain (a → b → c)', () => {
  // Preact
  const preactA = preactSignal(0);
  const preactB = preactComputed(() => preactA.value * 2);
  const preactC = preactComputed(() => preactB.value * 2);

  // Lattice current
  const latticeA = latticeSignal(0);
  const latticeB = latticeComputed(() => latticeA.value * 2);
  const latticeC = latticeComputed(() => latticeB.value * 2);

  // Class-optimized
  const classOptimizedA = classOptimized.signal(0);
  const classOptimizedB = classOptimized.computed(() => classOptimizedA.value * 2);
  const classOptimizedC = classOptimized.computed(() => classOptimizedB.value * 2);

  bench('Preact - computed chain', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactA.value = i;
      void preactC.value; // Force evaluation
    }
  });

  bench('Lattice (default global) - computed chain', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeA.value = i;
      void latticeC.value; // Force evaluation
    }
  });

  bench('Lattice (scoped) - computed chain', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      classOptimizedA.value = i;
      void classOptimizedC.value; // Force evaluation
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

  // Lattice current setup
  const latticeRoot = latticeSignal(0);
  const latticeA1 = latticeComputed(() => latticeRoot.value * 2);
  const latticeA2 = latticeComputed(() => latticeRoot.value * 3);
  const latticeB1 = latticeComputed(() => latticeA1.value + latticeA2.value);
  const latticeB2 = latticeComputed(() => latticeA1.value - latticeA2.value);
  const latticeC1 = latticeComputed(() => latticeB1.value * latticeB2.value);
  const latticeC2 = latticeComputed(() => latticeB1.value / (latticeB2.value || 1));
  const latticeResult = latticeComputed(() => latticeC1.value + latticeC2.value);

  // Class-optimized setup
  const classOptimizedRoot = classOptimized.signal(0);
  const classOptimizedA1 = classOptimized.computed(() => classOptimizedRoot.value * 2);
  const classOptimizedA2 = classOptimized.computed(() => classOptimizedRoot.value * 3);
  const classOptimizedB1 = classOptimized.computed(() => classOptimizedA1.value + classOptimizedA2.value);
  const classOptimizedB2 = classOptimized.computed(() => classOptimizedA1.value - classOptimizedA2.value);
  const classOptimizedC1 = classOptimized.computed(() => classOptimizedB1.value * classOptimizedB2.value);
  const classOptimizedC2 = classOptimized.computed(() => classOptimizedB1.value / (classOptimizedB2.value || 1));
  const classOptimizedResult = classOptimized.computed(() => classOptimizedC1.value + classOptimizedC2.value);

  bench('Preact - deep tree', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactRoot.value = i + 1; // Avoid divide by zero
      void preactResult.value;
    }
  });

  bench('Lattice (default global) - deep tree', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeRoot.value = i + 1; // Avoid divide by zero
      void latticeResult.value;
    }
  });

  bench('Lattice (scoped) - deep tree', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      classOptimizedRoot.value = i + 1; // Avoid divide by zero
      void classOptimizedResult.value;
    }
  });
});

describe('Diamond Pattern', () => {
  // Preact
  const preactSource = preactSignal(0);
  const preactLeft = preactComputed(() => preactSource.value * 2);
  const preactRight = preactComputed(() => preactSource.value * 3);
  const preactBottom = preactComputed(() => preactLeft.value + preactRight.value);

  // Lattice current
  const latticeSource = latticeSignal(0);
  const latticeLeft = latticeComputed(() => latticeSource.value * 2);
  const latticeRight = latticeComputed(() => latticeSource.value * 3);
  const latticeBottom = latticeComputed(() => latticeLeft.value + latticeRight.value);

  // Class-optimized
  const classOptimizedSource = classOptimized.signal(0);
  const classOptimizedLeft = classOptimized.computed(() => classOptimizedSource.value * 2);
  const classOptimizedRight = classOptimized.computed(() => classOptimizedSource.value * 3);
  const classOptimizedBottom = classOptimized.computed(() => classOptimizedLeft.value + classOptimizedRight.value);

  bench('Preact - diamond', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactSource.value = i;
      void preactBottom.value;
    }
  });

  bench('Lattice (default global) - diamond', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeSource.value = i;
      void latticeBottom.value;
    }
  });

  bench('Lattice (scoped) - diamond', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      classOptimizedSource.value = i;
      void classOptimizedBottom.value;
    }
  });
});

describe('Batch Updates', () => {
  // Preact
  const preactS1 = preactSignal(0);
  const preactS2 = preactSignal(0);
  const preactS3 = preactSignal(0);
  const preactSum = preactComputed(() => preactS1.value + preactS2.value + preactS3.value);

  // Lattice current
  const latticeS1 = latticeSignal(0);
  const latticeS2 = latticeSignal(0);
  const latticeS3 = latticeSignal(0);
  const latticeSum = latticeComputed(() => latticeS1.value + latticeS2.value + latticeS3.value);

  // Class-optimized
  const classOptimizedS1 = classOptimized.signal(0);
  const classOptimizedS2 = classOptimized.signal(0);
  const classOptimizedS3 = classOptimized.signal(0);
  const classOptimizedSum = classOptimized.computed(() => classOptimizedS1.value + classOptimizedS2.value + classOptimizedS3.value);

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

  bench('Lattice (default global) - batch updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeBatch(() => {
        latticeS1.value = i;
        latticeS2.value = i * 2;
        latticeS3.value = i * 3;
      });
      void latticeSum.value;
    }
  });

  bench('Lattice (scoped) - batch updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      classOptimized.batch(() => {
        classOptimizedS1.value = i;
        classOptimizedS2.value = i * 2;
        classOptimizedS3.value = i * 3;
      });
      void classOptimizedSum.value;
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

  // Lattice default global
  const latticeSignals = Array.from({ length: 10 }, (_, i) => latticeSignal(i));
  const latticeComputeds = latticeSignals.map((s, i) =>
    latticeComputed(() => {
      let sum = s.value;
      // Each computed depends on 3 signals
      if (i > 0) sum += latticeSignals[i - 1]!.value;
      if (i < latticeSignals.length - 1) sum += latticeSignals[i + 1]!.value;
      if (i > 1) sum += latticeSignals[i - 2]!.value;
      return sum;
    })
  );

  // Scoped
  const classOptimizedSignals = Array.from({ length: 10 }, (_, i) => classOptimized.signal(i));
  const classOptimizedComputeds = classOptimizedSignals.map((s, i) =>
    classOptimized.computed(() => {
      let sum = s.value;
      // Each computed depends on 3 signals
      if (i > 0) sum += classOptimizedSignals[i - 1]!.value;
      if (i < classOptimizedSignals.length - 1) sum += classOptimizedSignals[i + 1]!.value;
      if (i > 1) sum += classOptimizedSignals[i - 2]!.value;
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

  bench('Lattice (default global) - large graph', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeSignals[i % latticeSignals.length]!.value = i;
      // Sample a few computeds
      void latticeComputeds[0]!.value;
      void latticeComputeds[5]!.value;
      void latticeComputeds[9]!.value;
    }
  });

  bench('Lattice (scoped) - large graph', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      classOptimizedSignals[i % classOptimizedSignals.length]!.value = i;
      // Sample a few computeds
      void classOptimizedComputeds[0]!.value;
      void classOptimizedComputeds[5]!.value;
      void classOptimizedComputeds[9]!.value;
    }
  });
});

describe('Rapid Updates Without Reads', () => {
  // Preact
  const preactSig = preactSignal(0);
  const preactComp = preactComputed(() => preactSig.value * 2);

  // Lattice current
  const latticeSig = latticeSignal(0);
  const latticeComp = latticeComputed(() => latticeSig.value * 2);

  // Class-optimized
  const classOptimizedSig = classOptimized.signal(0);
  const classOptimizedComp = classOptimized.computed(() => classOptimizedSig.value * 2);

  bench('Preact - rapid updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      preactSig.value = i;
    }
    // Only read once at the end
    void preactComp.value;
  });

  bench('Lattice (default global) - rapid updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      latticeSig.value = i;
    }
    // Only read once at the end
    void latticeComp.value;
  });

  bench('Lattice (scoped) - rapid updates', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      classOptimizedSig.value = i;
    }
    // Only read once at the end
    void classOptimizedComp.value;
  });
});

describe('Read-heavy Workload', () => {
  // Preact
  const preactReadSignal = preactSignal(0);
  const preactReadComputed1 = preactComputed(() => preactReadSignal.value * 2);
  const preactReadComputed2 = preactComputed(() => preactReadSignal.value * 3);

  // Lattice current
  const latticeReadSignal = latticeSignal(0);
  const latticeReadComputed1 = latticeComputed(() => latticeReadSignal.value * 2);
  const latticeReadComputed2 = latticeComputed(() => latticeReadSignal.value * 3);

  // Class-optimized
  const classOptimizedReadSignal = classOptimized.signal(0);
  const classOptimizedReadComputed1 = classOptimized.computed(() => classOptimizedReadSignal.value * 2);
  const classOptimizedReadComputed2 = classOptimized.computed(() => classOptimizedReadSignal.value * 3);

  bench('Preact - many reads', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      void preactReadSignal.value;
      void preactReadComputed1.value;
      void preactReadComputed2.value;
      void preactReadSignal.value;
      void preactReadComputed1.value;
    }
  });

  bench('Lattice (default global) - many reads', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      void latticeReadSignal.value;
      void latticeReadComputed1.value;
      void latticeReadComputed2.value;
      void latticeReadSignal.value;
      void latticeReadComputed1.value;
    }
  });

  bench('Lattice (scoped) - many reads', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      void classOptimizedReadSignal.value;
      void classOptimizedReadComputed1.value;
      void classOptimizedReadComputed2.value;
      void classOptimizedReadSignal.value;
      void classOptimizedReadComputed1.value;
    }
  });
});