Found 12 benchmark suites

Running: batch-operations

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       541.40 µs/iter 537.96 µs  █
                    (529.71 µs … 675.38 µs) 617.67 µs  █▅
                    ( 11.04 kb …   1.32 mb) 937.46 kb ▁██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▂▂▁▁

Lattice                      766.54 µs/iter 764.29 µs  ▇█
                    (746.58 µs … 931.79 µs) 871.17 µs  ██
                    (414.41 kb …   1.31 mb) 938.17 kb ▁██▇▅▄▂▂▂▁▁▁▁▁▂▂▁▁▁▁▁

Alien                        428.33 µs/iter 428.33 µs    █
                    (419.96 µs … 565.38 µs) 454.96 µs    █
                    (456.00  b … 377.99 kb) 944.70  b ▁▁▁█▅▇▃▂▂▁▂▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■ 541.40 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 766.54 µs
                       Alien ┤ 428.33 µs
                             └                                            ┘

summary
  Alien
   1.26x faster than Preact
   1.79x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       131.36 µs/iter 129.96 µs  █
                    (124.96 µs … 326.63 µs) 206.75 µs  █
                    ( 36.12 kb … 555.66 kb) 204.36 kb ▁█▅▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      290.49 µs/iter 290.63 µs  █
                    (281.67 µs … 576.92 µs) 379.67 µs  █
                    ( 28.66 kb …   1.18 mb) 206.06 kb ▁█▄▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        218.09 µs/iter 217.88 µs   █
                    (209.21 µs … 380.63 µs) 289.79 µs  ▃█
                    (  7.46 kb … 811.47 kb) 149.95 kb ▁██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 131.36 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 290.49 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■ 218.09 µs
                             └                                            ┘

summary
  Preact
   1.66x faster than Alien
   2.21x faster than Lattice

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       408.73 µs/iter 406.54 µs   █
                    (390.92 µs … 543.54 µs) 499.08 µs   ██
                    ( 25.65 kb …   1.20 mb) 516.59 kb ▁▁██▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      572.25 µs/iter 567.79 µs  █
                    (557.96 µs … 746.83 µs) 655.63 µs  █▆
                    (504.87 kb …   2.26 mb)   1.12 mb ▁██▃▂▂▁▁▁▁▁▁▁▁▁▁▂▂▁▁▁

Alien                        434.46 µs/iter 434.50 µs  █
                    (425.25 µs … 564.08 µs) 485.46 µs  █▇
                    ( 71.15 kb … 693.87 kb) 110.87 kb ▁██▄▂▂█▂▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 408.73 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 572.25 µs
                       Alien ┤■■■■■ 434.46 µs
                             └                                            ┘

summary
  Preact
   1.06x faster than Alien
   1.4x faster than Lattice
  ✓ Completed in 10.82s

Running: computed-chains

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       399.91 µs/iter 399.54 µs   █
                    (392.08 µs … 460.63 µs) 434.17 µs   █
                    (408.00  b … 288.45 kb) 828.07  b ▁▇█▄▇▃▂▂▂▁▁▁▁▁▁▁▁▁▁▂▁

Lattice                      503.96 µs/iter 501.67 µs  █
                    (491.63 µs … 615.83 µs) 594.92 µs  █▆
                    (171.87 kb … 966.62 kb) 625.41 kb ▁██▃▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        363.89 µs/iter 361.21 µs  █
                    (347.33 µs … 459.33 µs) 443.38 µs  █
                    (408.00  b … 287.49 kb) 928.87  b ▃█▄▄▂▁▁▁▁▁▁▁▁▁▁▁▄▂▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■ 399.91 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 503.96 µs
                       Alien ┤ 363.89 µs
                             └                                            ┘

summary
  Alien
   1.1x faster than Preact
   1.38x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       217.56 µs/iter 219.21 µs      █   ▂
                    (207.00 µs … 262.17 µs) 235.04 µs      █   █
                    (120.00  b … 379.40 kb)   1.45 kb ▁▁▁▁▄█▂▅▄██▄▃▂▁▂▁▁▁▁▁

Lattice                      272.81 µs/iter 272.29 µs  █
                    (263.33 µs … 430.33 µs) 361.00 µs ▅█▄
                    (145.02 kb …   1.28 mb) 563.49 kb ███▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        222.65 µs/iter 224.13 µs       █
                    (213.08 µs … 272.38 µs) 240.71 µs      ██
                    ( 48.00  b … 508.05 kb)   1.91 kb ▁▁▁▁▂██▆▇▅▃▃▁▁▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 217.56 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 272.81 µs
                       Alien ┤■■■ 222.65 µs
                             └                                            ┘

summary
  Preact
   1.02x faster than Alien
   1.25x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       103.35 µs/iter 103.21 µs       █
                     (99.63 µs … 183.04 µs) 110.75 µs     ▂ █
                    (120.00  b … 322.90 kb) 914.21  b ▁▁▁▁█▂█▆▁▂▂▃▂▂▁▁▁▁▁▁▁

Lattice                      126.08 µs/iter 124.54 µs █
                    (122.00 µs … 317.71 µs) 202.67 µs █
                    (  1.88 kb … 688.18 kb) 307.09 kb █▇▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        107.30 µs/iter 106.83 µs   █
                    (105.42 µs … 140.54 µs) 118.33 µs  ▇█
                    ( 48.00  b … 282.90 kb)   1.06 kb ▁██▂▃▁▄▃▁▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 103.35 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 126.08 µs
                       Alien ┤■■■■■■ 107.30 µs
                             └                                            ┘

summary
  Preact
   1.04x faster than Alien
   1.22x faster than Lattice
  ✓ Completed in 10.80s

Running: conditional-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       592.59 µs/iter 589.88 µs    █
                    (567.50 µs … 749.54 µs) 684.75 µs   ▂█
                    (785.26 kb …   1.28 mb) 860.76 kb ▁▁██▅▃▂▂▁▂▂▁▁▁▁▂▁▁▁▁▁

Lattice                      595.39 µs/iter 597.88 µs     █
                    (570.38 µs … 688.83 µs) 657.13 µs     █▃
                    (504.00  b … 740.99 kb)   1.32 kb ▁▁▁▂██▃▃▆▃▂▂▁▁▁▁▁▁▁▁▁

Alien                        999.06 µs/iter 556.75 µs █
                     (537.13 µs … 12.71 ms)  11.40 ms █
                    (218.38 kb …   1.04 mb) 701.86 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 592.59 µs
                     Lattice ┤ 595.39 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 999.06 µs
                             └                                            ┘

summary
  Preact
   1x faster than Lattice
   1.69x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       917.64 µs/iter 911.33 µs  █
                      (898.83 µs … 1.26 ms)   1.06 ms  █
                    (370.52 kb …   2.91 mb) 862.94 kb ▄█▄▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                        1.38 ms/iter   1.38 ms        █
                        (1.33 ms … 1.62 ms)   1.46 ms       ▄█
                    (504.00  b … 860.16 kb)   3.09 kb ▁▁▁▁▃▁███▃▂▂▂▂▂▁▁▂▁▁▁

Alien                          1.28 ms/iter 869.92 µs █
                     (837.83 µs … 11.78 ms)  11.56 ms █
                    (297.75 kb …   1.09 mb) 702.65 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 917.64 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.38 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.28 ms
                             └                                            ┘

summary
  Preact
   1.39x faster than Alien
   1.5x faster than Lattice
  ✓ Completed in 8.65s

Running: dense-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   156.36 µs/iter 156.79 µs  █ ▂▂
                    (151.50 µs … 306.83 µs) 178.75 µs ██▇██▃▂▂▂▂▂▁▁▂▁▁▁▁▁▁▁
                  gc(  1.45 ms …   4.16 ms)   9.10 kb (456.00  b…  1.05 mb)

Preact - 75% dense updates   228.56 µs/iter 231.50 µs ▂    ▇█
                    (216.04 µs … 353.50 µs) 267.04 µs █▇▂▁▁██▅▃▂▂▁▂▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   3.29 ms)  40.47 kb (456.00  b…  1.02 mb)

Preact - 90% dense updates   279.31 µs/iter 281.71 µs           ██▅
                    (262.92 µs … 305.46 µs) 294.04 µs ▂▃▃▃▂▂▂▃▄████▆▅▄▂▂▂▁▂
                  gc(  1.35 ms …   2.81 ms)   1.57 kb (456.00  b… 40.45 kb)

Preact - 100% dense updates  300.18 µs/iter 302.71 µs          █
                    (287.67 µs … 320.00 µs) 318.33 µs ▄▆▂▁▁▁▁▁▃█▇▃▂▂▂▁▁▁▁▁▁
                  gc(  1.37 ms …   2.64 ms)   4.22 kb (456.00  b… 72.45 kb)

Lattice - 50% dense updates  185.23 µs/iter 183.92 µs █▅
                    (174.58 µs … 508.29 µs) 308.08 µs ██▆▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   4.83 ms) 182.66 kb (  9.30 kb…  1.65 mb)

Lattice - 75% dense updates  275.80 µs/iter 277.75 µs      █
                    (261.33 µs … 386.75 µs) 322.63 µs ▇▆▂▁██▅▃▂▂▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.44 ms …   4.34 ms) 160.29 kb ( 90.87 kb…585.67 kb)

Lattice - 90% dense updates  331.38 µs/iter 335.04 µs         █
                    (317.63 µs … 365.50 µs) 355.21 µs ▂██▂▁▁▂▄██▄▄▂▂▂▃▁▂▁▁▁
                  gc(  1.40 ms …   2.58 ms) 206.80 kb (157.84 kb…321.80 kb)

Lattice - 100% dense updates 359.18 µs/iter 361.46 µs        ▃█
                    (344.21 µs … 390.71 µs) 383.08 µs ▅▄▁▁▁▁▁██▆▄▃▂▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.59 ms) 216.68 kb ( 85.22 kb…362.22 kb)

Alien - 50% dense updates    151.69 µs/iter 154.96 µs  █
                    (144.29 µs … 209.63 µs) 173.38 µs ▃██▇▄▄▆▅▅▂▂▂▂▂▁▂▁▂▁▁▁
                  gc(  1.53 ms …   4.48 ms)  28.31 kb (504.00  b…  1.26 mb)

Alien - 75% dense updates    229.89 µs/iter 232.38 µs          ▅█
                    (214.71 µs … 266.21 µs) 248.54 µs ▂▃▅▂▂▁▁▁▃██▅▄▃▂▂▁▁▁▁▁
                  gc(  1.48 ms …   2.77 ms)  17.24 kb (504.00  b…308.27 kb)

Alien - 90% dense updates    272.25 µs/iter 274.92 µs           █▄
                    (257.25 µs … 305.71 µs) 288.71 µs ▂▆▂▂▁▂▂▃▅███▆▃▃▂▂▂▁▁▁
                  gc(  1.43 ms …   2.88 ms)   2.01 kb (504.00  b… 40.49 kb)

Alien - 100% dense updates   303.33 µs/iter 305.29 µs          ▅█
                    (288.17 µs … 326.25 µs) 318.79 µs ▂▂▂▁▁▁▃▃▃██▆▄▄▃▂▂▂▁▁▁
                  gc(  1.37 ms …   2.75 ms)   2.12 kb (504.00  b… 48.49 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■ 156.36 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■■■ 228.56 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 279.31 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■ 300.18 µs
 Lattice - 50% dense updates ┤■■■■■ 185.23 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■ 275.80 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 331.38 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 359.18 µs
   Alien - 50% dense updates ┤ 151.69 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■■■ 229.89 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■ 272.25 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■ 303.33 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   -1.01…+1.03x faster than Preact - $changeRatio% dense updates
   +1.18…+1.22x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.39s

Running: diamond-deps

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       650.01 µs/iter 651.38 µs     █
                    (639.75 µs … 717.50 µs) 680.21 µs     ██▆
                    (440.00  b … 318.45 kb)   1.07 kb ▁▂▆████▅▂▂▂▁▁▁▁▁▁▁▁▁▁

Lattice                      959.87 µs/iter 959.58 µs ▆█
                      (942.17 µs … 1.09 ms)   1.07 ms ██
                    (  0.98 mb …   2.20 mb)   1.60 mb ██▇▅▃▃▃▂▂▂▁▁▂▄▂▂▂▁▁▁▁

Alien                        574.69 µs/iter 573.96 µs   █
                    (561.67 µs … 771.83 µs) 627.04 µs   █▆
                    (504.00  b … 284.99 kb)   1.13 kb ▁▁██▅▃▂▂▃▂▂▁▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 650.01 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 959.87 µs
                       Alien ┤ 574.69 µs
                             └                                            ┘

summary
  Alien
   1.13x faster than Preact
   1.67x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       309.03 µs/iter 309.67 µs    █
                    (302.71 µs … 487.67 µs) 329.50 µs    █ ▃
                    (  7.68 kb … 567.09 kb)  56.51 kb ▁▁▃█▆█▆▂▃▁▂▁▁▁▁▁▁▁▁▁▁

Lattice                      289.37 µs/iter 288.83 µs  █
                    (282.25 µs … 538.38 µs) 373.17 µs  █
                    ( 30.34 kb …   1.27 mb) 260.19 kb ▁█▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        293.14 µs/iter 297.08 µs   █
                    (283.38 µs … 448.67 µs) 326.50 µs   █   ▂
                    ( 31.09 kb … 599.09 kb)  56.73 kb ▁███▄▃█▇▃▂▂▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.03 µs
                     Lattice ┤ 289.37 µs
                       Alien ┤■■■■■■■ 293.14 µs
                             └                                            ┘

summary
  Lattice
   1.01x faster than Alien
   1.07x faster than Preact

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       733.50 µs/iter 734.33 µs   █
                    (724.38 µs … 777.79 µs) 768.17 µs   █▇
                    (504.00  b … 870.78 kb)   1.40 kb ▁▁██▇▆▃▂▂▂▂▁▂▂▁▁▁▁▁▁▁

Lattice                      921.85 µs/iter 916.29 µs  ██
                      (898.75 µs … 1.16 ms)   1.03 ms  ██
                    (  1.01 mb …   3.54 mb)   1.60 mb ▁██▄▃▂▂▂▁▁▁▁▂▄▂▁▁▁▁▁▁

Alien                        618.71 µs/iter 617.96 µs  █
                    (603.25 µs … 763.29 µs) 720.46 µs  ██
                    (137.23 kb …   1.06 mb) 392.94 kb ▂██▅▄▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■ 733.50 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 921.85 µs
                       Alien ┤ 618.71 µs
                             └                                            ┘

summary
  Alien
   1.19x faster than Preact
   1.49x faster than Lattice
  ✓ Completed in 10.83s

Running: effect-triggers

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       323.59 µs/iter 326.04 µs       █
                    (283.46 µs … 629.83 µs) 406.54 µs       █
                    (744.00  b …   2.10 mb) 157.61 kb ▁▁▁▁▁▁██▃▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      370.66 µs/iter 373.13 µs       █
                    (329.25 µs … 550.46 µs) 448.46 µs       █
                    (504.00  b … 650.47 kb) 155.13 kb ▁▁▁▁▁▁██▇▂▂▂▁▁▁▁▁▁▁▁▁

Alien                        268.85 µs/iter 267.50 µs         █
                    (204.96 µs … 503.67 µs) 345.38 µs         █
                    (504.00  b …   2.28 mb) 157.50 kb ▁▁▁▁▁▁▁▁█▅▂▂▅▂▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■ 323.59 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 370.66 µs
                       Alien ┤ 268.85 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   1.38x faster than Lattice

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          216.47 µs/iter 215.88 µs  ▆█
                    (211.04 µs … 327.08 µs) 264.13 µs  ██
                    (120.00  b … 355.40 kb)   1.51 kb ▁██▅▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice - 10 effects         267.01 µs/iter 269.04 µs  ▇█
                    (262.08 µs … 613.83 µs) 282.50 µs  ██▃▃     ▄
                    ( 48.00  b … 806.99 kb)   2.17 kb ▁████▆▅█▃▆█▂▂▁▂▁▁▁▁▁▁

Alien - 10 effects           223.52 µs/iter 223.67 µs   █
                    (216.04 µs … 479.08 µs) 259.83 µs   █
                    (120.00  b … 798.57 kb)   1.67 kb ▁▂█▄▅▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤ 216.47 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 267.01 µs
          Alien - 10 effects ┤■■■■■ 223.52 µs
                             └                                            ┘

summary
  Preact - 10 effects
   1.03x faster than Alien - 10 effects
   1.23x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         7.57 µs/iter   7.42 µs      █
                      (7.08 µs … 185.50 µs)   8.17 µs      █▃
                    (312.00  b … 759.34 kb)  20.62 kb ▁▁▁▂▅██▆▄▂▂▂▂▁▁▁▁▁▁▁▁

Lattice                       11.65 µs/iter   7.88 µs  █
                        (7.21 µs … 2.94 ms)  18.13 µs  █
                    ( 24.00  b … 431.00 kb)  23.78 kb ▄█▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          5.72 µs/iter   5.75 µs  █      █
                        (5.68 µs … 5.81 µs)   5.78 µs  █ ██  ███     █    █
                    (678.48  b …   3.53 kb)   2.96 kb ██████▁███▁█▁▁████▁▁█

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■ 7.57 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 11.65 µs
                       Alien ┤ 5.72 µs
                             └                                            ┘

summary
  Alien
   1.32x faster than Preact
   2.03x faster than Lattice
  ✓ Completed in 10.88s

Running: filtered-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        297.71 µs/iter 315.79 µs    █
                    (277.29 µs … 369.00 µs) 336.96 µs    █
                    (120.00  b … 512.40 kb)   1.49 kb ▁▁▂█▇▂▃▁▁▁▁▁▁▅▂▁▆▂▁▂▁

Lattice - 90% filtered       474.95 µs/iter 472.13 µs  █
                    (463.63 µs … 613.13 µs) 572.96 µs  █
                    (145.50 kb …   1.04 mb) 625.54 kb ▁█▇▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien - 90% filtered         294.70 µs/iter 284.71 µs █
                    (281.04 µs … 370.38 µs) 360.04 µs █
                    ( 48.00  b … 448.40 kb)   1.47 kb █▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂▁

                             ┌                                            ┐
       Preact - 90% filtered ┤■ 297.71 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 474.95 µs
        Alien - 90% filtered ┤ 294.70 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1.01x faster than Preact - 90% filtered
   1.61x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       838.14 µs/iter 840.58 µs   █
                      (819.75 µs … 1.02 ms) 931.92 µs   █▄▄
                    ( 68.03 kb … 238.47 kb) 234.67 kb ▂▅███▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter        1.02 ms/iter   1.02 ms    ▂█
                      (978.88 µs … 1.16 ms)   1.12 ms    ██
                    (940.33 kb …   2.05 mb)   1.45 mb ▁▁▁███▅▂▃▃▂▁▁▁▂▂▂▁▂▁▁

Alien - toggle filter        756.44 µs/iter 754.08 µs    █▄
                    (729.33 µs … 926.88 µs) 847.29 µs    ██
                    ( 46.05 kb … 552.37 kb) 234.86 kb ▁▁▂██▄▃▃▂▂▂▁▁▁▁▁▁▁▂▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■■■■■ 838.14 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.02 ms
       Alien - toggle filter ┤ 756.44 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.11x faster than Preact - toggle filter
   1.35x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       421.16 µs/iter 425.96 µs      █
                    (403.62 µs … 470.00 µs) 449.00 µs      █▂
                    (504.00  b … 240.99 kb) 698.46  b ▁▁▁▂▁██▇▂▂▃▆▂▁▁▁▅▁▁▁▁

Lattice                      702.36 µs/iter 702.42 µs  █
                    (679.96 µs … 851.92 µs) 808.08 µs  ██
                    (409.66 kb …   2.05 mb)   1.22 mb ▁███▅▃▃▂▂▁▁▁▂▂▂▁▁▁▁▁▁

Alien                        417.22 µs/iter 417.63 µs    █
                    (401.54 µs … 513.58 µs) 474.46 µs    █▃
                    (504.00  b … 320.99 kb) 878.80  b ▁▁▁██▄▃▄▂▁▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 421.16 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 702.36 µs
                       Alien ┤ 417.22 µs
                             └                                            ┘

summary
  Alien
   1.01x faster than Preact
   1.68x faster than Lattice
  ✓ Completed in 10.80s

Running: scaling-subscribers

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       16.67 µs/iter  15.67 µs █
                      (14.83 µs … 45.33 µs)  36.38 µs █▅▁▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   2.98 ms)   7.70 kb (456.00  b…267.16 kb)

Preact - 50 subscribers       27.87 µs/iter  26.92 µs █
                      (26.33 µs … 73.63 µs)  45.63 µs █▅▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.98 ms)   6.99 kb (456.00  b…271.90 kb)

Preact - 100 subscribers      50.87 µs/iter  51.14 µs      █       ██
                      (49.68 µs … 51.83 µs)  51.47 µs █▁▁▁▁█▁▁▁▁▁▁▁████▁▁██
                  gc(  2.50 ms …   3.88 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     113.73 µs/iter 115.04 µs   ▆▄▃▄█▄
                    (104.25 µs … 137.54 µs) 133.63 µs ▅███████▄▂▃▃▃▃▄▃▄▄▂▂▂
                  gc(  1.48 ms …   2.93 ms)  22.98 kb (440.00  b…156.95 kb)

Preact - 400 subscribers     303.28 µs/iter 310.00 µs       █ ▂ ▃
                    (277.75 µs … 341.54 µs) 336.83 µs ▂▂▂▅▅████▇██▇▅▄▃▁▂▂▁▁
                  gc(  1.41 ms …   2.74 ms)   3.14 kb (456.00  b… 51.95 kb)

Lattice - 25 subscribers      17.82 µs/iter  17.29 µs  █
                      (15.29 µs … 61.71 µs)  37.38 µs ██▆▃▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   3.59 ms)  19.24 kb (  5.62 kb…264.40 kb)

Lattice - 50 subscribers      38.51 µs/iter  37.96 µs   ▆█
                     (33.25 µs … 170.88 µs)  60.83 µs ▃▇███▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.60 ms …  12.52 ms)  35.33 kb (120.00  b…371.80 kb)

Lattice - 100 subscribers     69.22 µs/iter  70.29 µs       █▆
                      (65.29 µs … 86.75 µs)  80.25 µs ▂██▅▆▇██▃▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   3.00 ms)  61.42 kb ( 36.24 kb…109.24 kb)

Lattice - 200 subscribers    130.96 µs/iter 131.04 µs   █▅
                    (129.75 µs … 141.50 µs) 137.21 µs ▂████▃▂▁▁▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.44 ms …   2.96 ms) 138.12 kb (112.93 kb…269.49 kb)

Lattice - 400 subscribers    322.70 µs/iter 327.54 µs       ▄█▇▄▅▅▂
                    (300.00 µs … 351.83 µs) 347.33 µs ▂▁▂▂▄▇███████▆▆▅▃▃▂▂▂
                  gc(  1.38 ms …   2.94 ms) 151.36 kb ( 16.99 kb…295.16 kb)

Alien - 25 subscribers        14.10 µs/iter  13.67 µs █
                      (12.67 µs … 40.83 µs)  32.33 µs █▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   3.06 ms)   5.55 kb (504.00  b…109.32 kb)

Alien - 50 subscribers        25.07 µs/iter  25.10 µs           █
                      (24.95 µs … 25.26 µs)  25.17 µs ███▁▁▁▁▁▁██▁▁█▁▁█▁▁▁█
                  gc(  2.06 ms …   2.99 ms)  20.39  b (  0.10  b…273.60  b)

Alien - 100 subscribers       49.88 µs/iter  50.00 µs █  ██  ██ █ █  ██  ██
                      (49.53 µs … 50.34 µs)  50.13 µs █▁▁██▁▁██▁█▁█▁▁██▁▁██
                  gc(  2.60 ms …   3.16 ms)   0.11  b (  0.10  b…  0.12  b)

Alien - 200 subscribers      108.76 µs/iter 111.21 µs ▃▃      ▄█
                    (104.00 µs … 125.33 µs) 120.29 µs ██▃▄█▆▆▇██▆▂▂▂▁▁▁▁▁▁▁
                  gc(  1.58 ms …   2.97 ms)  25.01 kb (504.00  b…156.99 kb)

Alien - 400 subscribers      323.33 µs/iter 330.88 µs      ▄█▆▄▅▃▅▂▅
                    (298.21 µs … 359.25 µs) 348.54 µs ▂▂▄▆▅█████████▇▆▇▆▅▄▂
                  gc(  1.47 ms …   2.74 ms)   4.06 kb (504.00  b…116.49 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 16.67 µs
     Preact - 50 subscribers ┤■■ 27.87 µs
    Preact - 100 subscribers ┤■■■■ 50.87 µs
    Preact - 200 subscribers ┤■■■■■■■■■■■ 113.73 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 303.28 µs
    Lattice - 25 subscribers ┤ 17.82 µs
    Lattice - 50 subscribers ┤■■■ 38.51 µs
   Lattice - 100 subscribers ┤■■■■■■ 69.22 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■■ 130.96 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 322.70 µs
      Alien - 25 subscribers ┤ 14.10 µs
      Alien - 50 subscribers ┤■ 25.07 µs
     Alien - 100 subscribers ┤■■■■ 49.88 µs
     Alien - 200 subscribers ┤■■■■■■■■■■ 108.76 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 323.33 µs
                             └                                            ┘

summary
  Preact - $sources subscribers
   +1.07…-1.18x faster than Alien - $sources subscribers
   +1.06…+1.07x faster than Lattice - $sources subscribers
  ✓ Completed in 32.87s

Running: signal-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          353.94 µs/iter 327.54 µs █
                    (313.88 µs … 602.79 µs) 572.04 µs █
                    (408.00  b … 354.23 kb)   1.07 kb ██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆▁

Lattice - write only         235.57 µs/iter 407.33 µs █
                     (94.67 µs … 488.63 µs) 461.25 µs █                ▃
                    (120.00  b … 456.40 kb)   1.52 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▃▁▆

Alien - write only            71.38 µs/iter  47.33 µs █
                     (45.88 µs … 604.33 µs) 564.54 µs █
                    ( 48.00  b … 717.40 kb) 499.73  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           244.52 µs/iter 404.29 µs █
                     (94.71 µs … 453.63 µs) 436.25 µs █                 ▇
                    ( 48.00  b … 429.66 kb)   1.25 kb █▂▁▁▁▁▁▁█▁▁▁▁▁▁▁▁▁██▂

Lattice - read only          214.76 µs/iter 403.88 µs █                  ▄
                     (37.83 µs … 441.17 µs) 416.54 µs █                  █
                    ( 48.00  b … 429.40 kb)   1.11 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▃

Alien - read only             91.55 µs/iter  60.04 µs █
                     (59.21 µs … 611.88 µs) 574.25 µs █
                    ( 32.00  b … 813.40 kb) 450.30  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    380.60 µs/iter 343.50 µs █
                    (331.42 µs … 870.58 µs) 831.21 µs █
                    (408.00  b … 309.61 kb)   0.98 kb █▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃

Lattice - read/write mixed   309.40 µs/iter 753.38 µs █
                     (95.75 µs … 818.54 µs) 794.75 µs █
                    ( 48.00  b … 632.90 kb)   1.40 kb █▁▁▁▁▁▇▂▁▁▁▁▁▁▁▁▁▁▁▆▆

Alien - read/write mixed     349.96 µs/iter 207.63 µs █
                      (126.33 µs … 1.50 ms)   1.46 ms █
                    (408.00  b … 160.49 kb) 680.73  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▃

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 353.94 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 235.57 µs
          Alien - write only ┤ 71.38 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■■ 244.52 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 214.76 µs
           Alien - read only ┤■■ 91.55 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 380.60 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.40 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 349.96 µs
                             └                                            ┘

summary
  Alien - write only
   1.28x faster than Alien - read only
   3.01x faster than Lattice - read only
   3.3x faster than Lattice - write only
   3.43x faster than Preact - read only
   4.33x faster than Lattice - read/write mixed
   4.9x faster than Alien - read/write mixed
   4.96x faster than Preact - write only
   5.33x faster than Preact - read/write mixed
  ✓ Completed in 10.81s

Running: sparse-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   37.80 µs/iter  36.42 µs  █
                     (34.71 µs … 112.83 µs)  69.42 µs ██▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   3.38 ms)  11.24 kb (456.00  b…293.96 kb)

Preact - 15% sparse updates   46.32 µs/iter  45.67 µs  █
                      (43.46 µs … 81.13 µs)  69.17 µs ▇██▁▂▁▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.34 ms …   3.05 ms)   6.27 kb (456.00  b…213.27 kb)

Preact - 20% sparse updates   56.16 µs/iter  56.42 µs                  █
                      (55.23 µs … 56.84 µs)  56.57 µs ▅▁▅▁▁▅▁▁▁▁▁▁▅▁▁▁▁█▅▅▅
                  gc(  2.49 ms …   4.03 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   73.88 µs/iter  74.71 µs  █  ▇
                      (71.46 µs … 93.67 µs)  87.08 µs ▆█▇██▆▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.34 ms …   2.58 ms)  14.09 kb (456.00  b…132.95 kb)

Lattice - 10% sparse updates  37.05 µs/iter  35.83 µs █
                      (35.29 µs … 93.42 µs)  78.54 µs █▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.40 ms …   3.38 ms)  39.26 kb ( 11.18 kb…968.09 kb)

Lattice - 15% sparse updates  59.45 µs/iter  66.13 µs  █
                      (53.17 µs … 74.75 µs)  72.33 µs ▁█▄▃▂▁▁▁▂▁▁▁▂▃▅▄▂▁▁▁▁
                  gc(  1.33 ms …   2.92 ms)  58.49 kb ( 26.87 kb…176.46 kb)

Lattice - 20% sparse updates  78.57 µs/iter  85.83 µs ▅█
                      (71.04 µs … 94.08 µs)  90.38 µs ███▅▃▁▂▁▁▁▁▂▂▄▅██▆▄▂▁
                  gc(  1.43 ms …   2.89 ms)  74.91 kb ( 42.49 kb…195.49 kb)

Lattice - 25% sparse updates  97.87 µs/iter 104.00 µs █▆        ▂▆▅
                     (88.54 µs … 130.46 µs) 116.33 µs ███▅▃▁▁▁▄▇███▄▃▁▁▁▁▁▁
                  gc(  1.39 ms …   2.94 ms)  95.48 kb ( 70.62 kb…211.12 kb)

Alien - 10% sparse updates    35.09 µs/iter  39.25 µs █      ▃
                      (29.75 µs … 74.79 µs)  58.83 µs ██▂▂▂▂██▁▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.40 ms …   2.98 ms)   8.56 kb (456.00  b…244.82 kb)

Alien - 15% sparse updates    44.51 µs/iter  44.83 µs  █ ▂
                      (43.58 µs … 58.13 µs)  52.33 µs ▇███▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   2.97 ms)   5.92 kb (456.00  b… 92.95 kb)

Alien - 20% sparse updates    55.38 µs/iter  55.61 µs        ██
                      (54.89 µs … 56.00 µs)  55.88 µs ██▁▁█▁▁███▁▁▁▁▁█▁▁▁██
                  gc(  2.58 ms …   4.06 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    75.51 µs/iter  76.88 µs ▅▅   ▅██▅▅
                      (71.96 µs … 92.79 µs)  84.33 µs ██▅▅███████▃▁▁▁▁▁▁▁▁▂
                  gc(  1.45 ms …   2.81 ms)  14.08 kb (456.00  b…132.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■ 37.80 µs
 Preact - 15% sparse updates ┤■■■■■■ 46.32 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■ 56.16 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■ 73.88 µs
Lattice - 10% sparse updates ┤■ 37.05 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■ 59.45 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■ 78.57 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 97.87 µs
  Alien - 10% sparse updates ┤ 35.09 µs
  Alien - 15% sparse updates ┤■■■■■ 44.51 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■ 55.38 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■ 75.51 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   -1.02…+1.08x faster than Preact - $changeRatio% sparse updates
   +1.3…+1.06x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.27s

Running: wide-fanout

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       325.99 µs/iter 317.79 µs ▃█
                      (299.58 µs … 1.88 ms) 820.50 µs ██
                    ( 54.80 kb … 567.09 kb)  56.77 kb ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      288.74 µs/iter 288.83 µs  █
                    (276.42 µs … 512.58 µs) 396.17 µs  █▂
                    ( 19.16 kb … 741.85 kb) 260.56 kb ▂██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        294.71 µs/iter 293.50 µs  ▂█
                    (287.54 µs … 437.29 µs) 316.83 µs  ██▂
                    (  2.68 kb … 648.68 kb)  56.92 kb ▁███▆▃▂▁▁▁▁▅▁▂▁▁▁▅▂▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 325.99 µs
                     Lattice ┤ 288.74 µs
                       Alien ┤■■■■■ 294.71 µs
                             └                                            ┘

summary
  Lattice
   1.02x faster than Alien
   1.13x faster than Preact

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       364.91 µs/iter 364.79 µs    █
                    (357.63 µs … 622.42 µs) 383.50 µs    █
                    (  5.87 kb …   1.75 mb)   8.28 kb ▁▁▁██▆▅▂▂▁▁▁▅▂▁▁▁▁▁▁▁

Lattice                      215.56 µs/iter 215.50 µs  █
                    (209.29 µs … 357.58 µs) 268.54 µs  █
                    (  6.18 kb … 481.28 kb)  28.34 kb ▁█▅▅▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        297.96 µs/iter 298.92 µs  █
                    (290.71 µs … 430.96 µs) 357.46 µs  █
                    (  5.50 kb … 993.76 kb)   8.46 kb ▁██▆▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 364.91 µs
                     Lattice ┤ 215.56 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■ 297.96 µs
                             └                                            ┘

summary
  Lattice
   1.38x faster than Alien
   1.69x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       258.35 µs/iter 258.42 µs   █
                    (252.54 µs … 322.50 µs) 288.71 µs   █
                    (  5.59 kb … 606.70 kb)   7.32 kb ▁▁██▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      119.56 µs/iter 119.88 µs   █
                    (113.96 µs … 323.63 µs) 150.17 µs   █
                    (  3.77 kb … 502.90 kb)  40.50 kb ▁▁█▄▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        257.53 µs/iter 257.13 µs  █
                    (252.54 µs … 415.83 µs) 288.54 µs  █
                    (  5.52 kb … 921.43 kb)   8.16 kb ██▇▆▂▂▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 258.35 µs
                     Lattice ┤ 119.56 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 257.53 µs
                             └                                            ┘

summary
  Lattice
   2.15x faster than Alien
   2.16x faster than Preact
  ✓ Completed in 10.81s

Running: write-heavy

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        55.31 µs/iter  56.08 µs   █
                     (53.62 µs … 116.13 µs)  63.58 µs  ▄█  ▂
                    ( 32.00  b …   1.65 mb)   0.99 kb ▂██▂▂█▂▂▁▁▁▁▁▁▁▂▁▁▁▁▁

Lattice                      141.56 µs/iter 141.00 µs   █
                    (137.79 µs … 277.75 µs) 157.50 µs   █
                    (  1.40 kb … 490.99 kb)  14.31 kb ▁▁█▂▂▃▂▂▁▁▁▁▁▃▁▁▁▁▁▁▁

Alien                         46.01 µs/iter  44.58 µs  █
                     (42.96 µs … 128.38 µs)  84.33 µs  █
                    ( 32.00  b …   1.95 mb) 776.60  b ▁█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 55.31 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 141.56 µs
                       Alien ┤ 46.01 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   3.08x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        48.73 µs/iter  48.00 µs   █
                      (46.42 µs … 90.29 µs)  60.08 µs   █
                    ( 32.00  b … 376.99 kb) 848.44  b ▁▂█▂▂▁▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁

Lattice                      133.92 µs/iter 134.58 µs      █
                    (125.42 µs … 212.67 µs) 150.83 µs      █
                    (  1.30 kb … 581.74 kb)   3.44 kb ▂▁▂▁▁█▂▃▂▂▂▁▂▃▁▁▁▂▁▁▁

Alien                         40.32 µs/iter  40.17 µs █
                      (38.46 µs … 85.83 µs)  78.17 µs █
                    ( 48.00  b … 250.90 kb) 489.11  b ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 48.73 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 133.92 µs
                       Alien ┤ 40.32 µs
                             └                                            ┘

summary
  Alien
   1.21x faster than Preact
   3.32x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        94.51 µs/iter  93.75 µs      █
                     (90.67 µs … 229.17 µs) 103.33 µs      █
                    (  5.52 kb … 539.96 kb)   6.89 kb ▁▁▁▂██▂▂▁▄▂▃▁▁▁▁▁▁▁▁▁

Lattice                      182.56 µs/iter 190.58 µs  ▄      █
                    (156.04 µs … 345.54 µs) 241.13 µs  █      █
                    ( 29.74 kb … 484.98 kb)  69.44 kb ▃█▆▂▂▁▁▁█▆▁▁▁▁▁▂▄▂▁▁▁

Alien                        136.26 µs/iter 136.21 µs    █
                    (130.00 µs … 356.13 µs) 156.04 µs    █
                    (  5.52 kb … 675.46 kb)   7.06 kb ▁▁▂█▂▂▃▂▁▃▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 94.51 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 182.56 µs
                       Alien ┤■■■■■■■■■■■■■■■■ 136.26 µs
                             └                                            ┘

summary
  Preact
   1.44x faster than Alien
   1.93x faster than Lattice
  ✓ Completed in 10.82s

Summary:
  Total: 12
  Success: 12
  Failed: 0