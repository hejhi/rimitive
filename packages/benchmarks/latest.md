Found 12 benchmark suites

Running: batch-operations

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       547.31 µs/iter 547.54 µs    █
                    (518.63 µs … 960.83 µs) 647.63 µs    █
                    ( 10.85 kb …   1.32 mb) 937.45 kb ▂▁▄█▇▆▃▂▁▁▁▁▁▁▂▁▁▁▁▁▁

Lattice                      609.61 µs/iter 613.33 µs   █
                    (576.04 µs … 842.25 µs) 745.92 µs   ██▃
                    (566.38 kb …   1.21 mb) 937.86 kb ▆▃███▆▃▂▂▂▂▂▁▂▂▂▁▁▁▁▁

Alien                        430.76 µs/iter 432.54 µs        █
                    (406.75 µs … 577.29 µs) 461.38 µs        █▆
                    (456.00  b … 377.99 kb) 997.63  b ▁▁▁▂▂▁▂███▄▃▇▂▁▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■ 547.31 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 609.61 µs
                       Alien ┤ 430.76 µs
                             └                                            ┘

summary
  Alien
   1.27x faster than Preact
   1.42x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       133.80 µs/iter 133.71 µs  █
                    (126.88 µs … 295.71 µs) 208.88 µs  █▂
                    ( 12.25 kb …   1.18 mb) 204.56 kb ▁██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      199.67 µs/iter 199.42 µs  ▅█
                    (189.08 µs … 424.04 µs) 279.46 µs  ██▂
                    ( 20.66 kb … 658.16 kb) 204.98 kb ▂███▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        218.12 µs/iter 218.63 µs   █
                    (208.13 µs … 365.92 µs) 289.88 µs  ██▃
                    (  4.48 kb … 747.47 kb) 150.06 kb ▁███▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 133.80 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■ 199.67 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 218.12 µs
                             └                                            ┘

summary
  Preact
   1.49x faster than Lattice
   1.63x faster than Alien

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       411.20 µs/iter 410.67 µs   █
                    (391.42 µs … 542.58 µs) 508.92 µs   ██
                    (220.20 kb … 981.28 kb) 517.09 kb ▂▂██▇▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      555.46 µs/iter 561.33 µs    █
                    (526.79 µs … 766.17 µs) 653.38 µs    █
                    ( 77.28 kb …   1.78 mb) 517.64 kb ▂▁██▇██▃▃▂▁▁▁▁▁▂▁▁▁▁▁

Alien                        440.51 µs/iter 445.71 µs     █  ▃
                    (417.71 µs … 581.21 µs) 496.46 µs    ██  █
                    ( 71.17 kb … 693.87 kb) 110.88 kb ▂▂▁███▅██▄▃▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 411.20 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 555.46 µs
                       Alien ┤■■■■■■■ 440.51 µs
                             └                                            ┘

summary
  Preact
   1.07x faster than Alien
   1.35x faster than Lattice
  ✓ Completed in 10.81s

Running: computed-chains

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       400.43 µs/iter 401.38 µs     █
                    (384.67 µs … 455.88 µs) 438.13 µs     █ ▂
                    (408.00  b … 288.45 kb) 821.18  b ▁▁▁████▄▄▃▂▂▂▁▁▁▁▁▂▁▁

Lattice                      476.88 µs/iter 477.71 µs         █
                    (459.75 µs … 534.21 µs) 493.38 µs         █ ▅
                    (504.00  b … 341.49 kb) 917.03  b ▁▁▁▁▁▁▁▁█▅█▄▄▃▂▂▂▂▂▁▁

Alien                        367.66 µs/iter 362.42 µs   █
                    (341.25 µs … 499.63 µs) 473.46 µs   █▂
                    (408.00  b … 287.49 kb) 981.75  b ▂▆██▂▂▁▁▁▁▁▁▁▁▁▁▂▃▂▂▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■ 400.43 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 476.88 µs
                       Alien ┤ 367.66 µs
                             └                                            ┘

summary
  Alien
   1.09x faster than Preact
   1.3x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       221.88 µs/iter 224.38 µs      █
                    (210.04 µs … 276.67 µs) 237.92 µs      █   ▅
                    (104.00  b … 445.90 kb)   1.44 kb ▁▁▁▁▁█▄▅▂██▄▃▂█▂▁▁▁▁▁

Lattice                      235.90 µs/iter 236.25 µs     █
                    (225.50 µs … 451.63 µs) 260.21 µs     █ ▂
                    ( 48.00  b … 556.49 kb)   1.75 kb ▁▁▁▁█▅█▃▄▂▂▂▁▁▁▁▁▁▁▁▁

Alien                        224.61 µs/iter 225.92 µs      █
                    (214.21 µs … 299.50 µs) 245.08 µs     ██
                    ( 48.00  b … 531.93 kb)   1.71 kb ▂▁▁▂██▇▇▄▅▂▃▄▂▂▂▂▂▁▁▁

                             ┌                                            ┐
                      Preact ┤ 221.88 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 235.90 µs
                       Alien ┤■■■■■■■ 224.61 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.06x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       112.02 µs/iter 111.79 µs       █
                    (106.96 µs … 260.13 µs) 122.67 µs     ▂ █
                    (120.00  b …   1.27 mb)   1.05 kb ▁▂▁▁█▃█▃▃▄▃▂▁▁▁▁▁▁▁▁▁

Lattice                      117.28 µs/iter 117.83 µs     █
                    (112.50 µs … 385.50 µs) 131.96 µs    ▂█
                    ( 48.00  b … 659.88 kb)   1.47 kb ▁▁▁██▃▅▄▂▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        112.86 µs/iter 114.54 µs    █
                    (108.71 µs … 178.92 µs) 124.83 µs    █
                    ( 32.00  b … 259.40 kb)   1.08 kb ▁▂▁█▂▃▃▇▄▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 112.02 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 117.28 µs
                       Alien ┤■■■■■ 112.86 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.05x faster than Lattice
  ✓ Completed in 10.82s

Running: conditional-deps

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       586.89 µs/iter 584.33 µs  █
                    (571.08 µs … 725.79 µs) 681.13 µs  ██
                    (408.91 kb …   1.28 mb) 860.21 kb ▁██▅▄▂▁▁▁▁▁▁▁▁▁▂▂▂▁▁▁

Lattice                      488.68 µs/iter 493.63 µs       █▂
                    (472.08 µs … 549.83 µs) 521.71 µs  ▄▃   ██    ▃
                    (504.00  b … 598.49 kb)   1.19 kb ▄███▆████▅▅▅█▃▂▃▂▂▂▁▁

Alien                          1.01 ms/iter 561.58 µs █
                     (521.88 µs … 12.89 ms)  11.58 ms █
                    (292.18 kb …   1.06 mb) 701.90 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■ 586.89 µs
                     Lattice ┤ 488.68 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.01 ms
                             └                                            ┘

summary
  Lattice
   1.2x faster than Preact
   2.06x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       923.99 µs/iter 929.17 µs    █▄
                      (876.00 µs … 1.10 ms)   1.05 ms    ██▂
                    (367.09 kb …   1.30 mb) 859.83 kb ▂▁▂███▅▅▄▂▂▁▂▂▁▂▁▁▂▁▁

Lattice                        1.18 ms/iter   1.18 ms     █
                        (1.11 ms … 2.72 ms)   1.46 ms     █
                    (504.00  b … 517.99 kb)   1.80 kb ▆▄█▆██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          1.27 ms/iter 847.25 µs █
                     (795.38 µs … 12.13 ms)  11.58 ms █
                    (263.75 kb …   1.12 mb) 702.63 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 923.99 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■ 1.18 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.27 ms
                             └                                            ┘

summary
  Preact
   1.28x faster than Lattice
   1.37x faster than Alien
  ✓ Completed in 8.67s

Running: dense-updates

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   167.06 µs/iter 166.08 µs  █
                    (159.88 µs … 480.08 µs) 208.38 µs ▄█▅▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   4.36 ms)  15.98 kb (456.00  b…  1.29 mb)

Preact - 75% dense updates   232.01 µs/iter 232.71 µs  ▂█
                    (223.92 µs … 410.96 µs) 265.13 µs ▅██▇▆▄▂▂▁▂▁▁▁▂▁▁▁▁▁▁▁
                  gc(  1.37 ms …   3.35 ms)  12.65 kb (456.00  b…  1.32 mb)

Preact - 90% dense updates   278.00 µs/iter 286.88 µs █
                    (268.50 µs … 338.42 µs) 313.63 µs ██▂▂▁▁▁▄▄▄▃▂▁▁▁▁▁▂▁▁▁
                  gc(  1.37 ms …   2.26 ms)   7.62 kb (456.00  b…116.45 kb)

Preact - 100% dense updates  316.91 µs/iter 322.04 µs ▄    ▆██▅
                    (299.00 µs … 374.13 µs) 358.00 µs ██▄▅▄████▇▅▃▂▁▁▂▁▂▁▁▁
                  gc(  1.36 ms …   2.90 ms)   8.09 kb (456.00  b… 72.45 kb)

Lattice - 50% dense updates  164.52 µs/iter 161.96 µs █
                    (160.29 µs … 349.04 µs) 203.96 µs █▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.49 ms …   4.68 ms)  40.88 kb (504.00  b…  1.38 mb)

Lattice - 75% dense updates  263.52 µs/iter 268.58 µs      ▄█▃▃
                    (244.63 µs … 318.29 µs) 304.21 µs ██▆▂▂████▆▃▃▂▃▂▂▂▂▁▁▂
                  gc(  1.44 ms …   2.75 ms)  21.89 kb (504.00  b…296.95 kb)

Lattice - 90% dense updates  303.63 µs/iter 309.79 µs  █    ▄
                    (288.63 µs … 370.54 µs) 346.79 µs ▇█▁▁▂▇██▆▄▂▂▂▂▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.82 ms)   4.46 kb (504.00  b… 72.49 kb)

Lattice - 100% dense updates 338.69 µs/iter 342.46 µs  ▃   ▃█▄
                    (320.38 µs … 396.96 µs) 379.71 µs ▅█▂▂▁███▇▃▂▃▂▂▂▂▁▁▂▁▁
                  gc(  1.35 ms …   2.85 ms)   2.65 kb (456.00  b… 72.49 kb)

Alien - 50% dense updates    146.74 µs/iter 145.92 µs █▃
                    (143.08 µs … 278.04 µs) 179.29 µs ██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   4.67 ms)  38.17 kb (504.00  b…  1.50 mb)

Alien - 75% dense updates    233.83 µs/iter 237.75 µs       █
                    (217.42 µs … 308.54 µs) 274.33 µs ▃▇▄▅▃▅██▅▄▂▁▂▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   2.88 ms)  18.60 kb (504.00  b…149.05 kb)

Alien - 90% dense updates    271.19 µs/iter 277.38 µs  █
                    (256.29 µs … 334.00 µs) 310.42 µs ▄█▃▁▂▁██▆▅▂▂▂▂▁▂▁▁▁▁▁
                  gc(  1.43 ms …   2.83 ms)   4.28 kb (504.00  b…104.99 kb)

Alien - 100% dense updates   306.96 µs/iter 310.29 µs      ▇█
                    (289.17 µs … 356.00 µs) 348.00 µs ▂▄▆▃▂██▇▇▄▃▂▁▁▁▂▁▁▁▁▁
                  gc(  1.40 ms …   2.88 ms)   3.31 kb (504.00  b… 51.99 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■■■ 167.06 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■■■■■ 232.01 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 278.00 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 316.91 µs
 Lattice - 50% dense updates ┤■■■ 164.52 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 263.52 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 303.63 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 338.69 µs
   Alien - 50% dense updates ┤ 146.74 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■■■■■ 233.83 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■ 271.19 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 306.96 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.03…+1.14x faster than Preact - $changeRatio% dense updates
   +1.1…+1.12x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.36s

Running: diamond-deps

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       692.11 µs/iter 693.88 µs    █▄
                    (679.00 µs … 797.33 µs) 730.17 µs    ██
                    (456.00  b … 241.71 kb) 811.20  b ▁▁▃██▅▄▃▄▃▂▃▂▂▁▁▁▁▁▁▁

Lattice                      906.07 µs/iter 908.67 µs       █
                    (870.04 µs … 992.46 µs) 975.67 µs      ▇█
                    (504.00  b … 518.99 kb)   1.16 kb ▁▁▁▁▁██▆▆▄▃▂▂▂▁▁▁▁▁▁▁

Alien                        603.25 µs/iter 605.54 µs        █
                    (566.67 µs … 715.46 µs) 665.54 µs        █
                    (504.00  b … 319.07 kb)   1.04 kb ▁▁▂▂▃▅▃█▇▆▂▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■ 692.11 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 906.07 µs
                       Alien ┤ 603.25 µs
                             └                                            ┘

summary
  Alien
   1.15x faster than Preact
   1.5x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       333.24 µs/iter 333.50 µs   █
                    (325.42 µs … 513.33 µs) 362.17 µs   █ ▅
                    (  8.29 kb … 567.09 kb)  56.58 kb ▂▁█▇█▅▄▃▃▂▂▁▁▁▁▁▁▁▁▁▁

Lattice                      253.06 µs/iter 254.04 µs     █
                    (240.96 µs … 429.75 µs) 281.96 µs     █▄▇
                    ( 16.46 kb … 515.05 kb)  56.65 kb ▁▁▃▂███▇▅▃▂▂▁▁▁▁▁▁▁▁▁

Alien                        298.69 µs/iter 300.96 µs    █
                    (283.13 µs … 481.42 µs) 337.83 µs    █▂
                    ( 23.59 kb …   1.42 mb)  57.26 kb ▁▁▂██▄▄▄▂▃▂▂▂▅▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 333.24 µs
                     Lattice ┤ 253.06 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■ 298.69 µs
                             └                                            ┘

summary
  Lattice
   1.18x faster than Alien
   1.32x faster than Preact

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       727.16 µs/iter 729.37 µs       ▄█
                    (702.00 µs … 815.83 µs) 767.92 µs       ███▂
                    (504.00  b … 976.66 kb)   1.75 kb ▁▁▁▂▂▄████▄▂▂▁▁▁▁▁▁▁▁

Lattice                      887.58 µs/iter 890.42 µs       ██
                    (854.08 µs … 970.54 µs) 937.13 µs       ██
                    (456.00  b …   2.05 mb)   3.76 kb ▁▁▁▁▂▂███▇▆▃▃▃▁▂▂▁▂▁▁

Alien                        625.51 µs/iter 626.46 µs    █
                    (597.04 µs … 779.00 µs) 725.38 µs    █▅
                    (391.13 kb …   1.43 mb) 393.47 kb ▁▁▂██▆▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■ 727.16 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 887.58 µs
                       Alien ┤ 625.51 µs
                             └                                            ┘

summary
  Alien
   1.16x faster than Preact
   1.42x faster than Lattice
  ✓ Completed in 10.83s

Running: effect-triggers

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       320.83 µs/iter 324.21 µs       █
                    (278.54 µs … 600.04 µs) 399.79 µs       █▃▃
                    (744.00  b …   1.93 mb) 157.82 kb ▁▁▁▁▁▂███▃▁▁▁▁▁▁▁▁▁▁▁

Lattice                      346.02 µs/iter 348.13 µs        █
                    (301.50 µs … 498.96 µs) 415.63 µs        █▂
                    (504.00  b … 945.24 kb) 155.10 kb ▁▁▁▁▁▁▁██▅▂▁▁▁▁▁▁▁▁▁▁

Alien                        266.26 µs/iter 265.25 µs       █
                    (227.46 µs … 510.71 µs) 339.33 µs       █
                    (504.00  b …   2.14 mb) 157.42 kb ▁▁▁▁▁▂█▅▁▁▁▅▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■ 320.83 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 346.02 µs
                       Alien ┤ 266.26 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   1.3x faster than Lattice

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          214.21 µs/iter 216.75 µs   █
                    (208.13 µs … 274.29 µs) 230.63 µs   █ █
                    (120.00  b … 434.90 kb)   1.51 kb ▂▁█▂█▇▄▄▄▃█▂▂▂▁▁▁▂▁▁▁

Lattice - 10 effects         261.28 µs/iter 262.42 µs  █▇
                    (254.67 µs … 345.38 µs) 303.88 µs  ██
                    (120.00  b … 547.49 kb)   2.06 kb ▁████▆▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien - 10 effects           221.15 µs/iter 222.25 µs      █
                    (212.42 µs … 280.96 µs) 238.42 µs      █
                    (120.00  b … 857.23 kb)   1.84 kb ▁▁▁▁▁█▃▆▅▂▃▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤ 214.21 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 261.28 µs
          Alien - 10 effects ┤■■■■■ 221.15 µs
                             └                                            ┘

summary
  Preact - 10 effects
   1.03x faster than Alien - 10 effects
   1.22x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         7.56 µs/iter   7.42 µs    █▂
                      (6.96 µs … 188.75 µs)   9.29 µs    ██
                    (  1.29 kb … 660.27 kb)  20.61 kb ▁▁▂██▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                       11.41 µs/iter   7.71 µs  █
                        (7.08 µs … 2.80 ms)  18.17 µs  █
                    ( 24.00  b … 446.76 kb)  23.75 kb ▆█▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          5.77 µs/iter   5.80 µs  █          █    █
                        (5.71 µs … 5.87 µs)   5.86 µs ███ █  ██   █    █
                    (639.42  b …   3.53 kb)   2.95 kb █████▁▁███▁██▁█▁██▁▁█

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■ 7.56 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 11.41 µs
                       Alien ┤ 5.77 µs
                             └                                            ┘

summary
  Alien
   1.31x faster than Preact
   1.98x faster than Lattice
  ✓ Completed in 10.91s

Running: filtered-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        298.98 µs/iter 315.54 µs  █
                    (282.37 µs … 366.63 µs) 335.96 µs  █
                    (120.00  b … 429.40 kb)   1.51 kb ▂██▄▄▄▂▂▂▁▂▁▅▂▂▂▆▄▂▂▁

Lattice - 90% filtered       403.16 µs/iter 404.75 µs  █▆▂
                    (395.67 µs … 454.04 µs) 436.50 µs  ███
                    (408.00  b … 493.52 kb)   1.51 kb ▁███▆▆▅▃▆▂▂▁▁▁▁▁▁▁▁▁▂

Alien - 90% filtered         298.04 µs/iter 291.42 µs  █
                    (278.33 µs … 387.50 µs) 367.42 µs  █ ▃
                    ( 48.00  b … 472.40 kb)   1.61 kb ▂███▂▂▁▁▁▁▁▁▁▁▁▁▁▄▄▂▂

                             ┌                                            ┐
       Preact - 90% filtered ┤ 298.98 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 403.16 µs
        Alien - 90% filtered ┤ 298.04 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1x faster than Preact - 90% filtered
   1.35x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       811.87 µs/iter 812.29 µs   █▅
                    (794.04 µs … 973.96 µs) 894.33 µs   ██
                    (234.87 kb … 238.07 kb) 234.87 kb ▁▁██▇▅▃▄▁▂▁▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter      947.68 µs/iter 950.08 µs   ▂█
                      (926.38 µs … 1.13 ms)   1.03 ms   ██▂
                    (196.15 kb … 829.37 kb) 235.66 kb ▂▁███▇▄▃▂▂▂▂▁▂▁▁▁▁▁▁▁

Alien - toggle filter        766.03 µs/iter 767.46 µs     █
                    (736.00 µs … 913.50 µs) 860.92 µs     █▇
                    ( 46.38 kb … 550.87 kb) 234.88 kb ▁▄▂▃██▆▃▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■■■ 811.87 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 947.68 µs
       Alien - toggle filter ┤ 766.03 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.06x faster than Preact - toggle filter
   1.24x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       421.12 µs/iter 425.08 µs    █
                    (411.92 µs … 489.71 µs) 442.17 µs    █ ▃
                    (504.00  b … 260.49 kb) 710.31  b ▁▁▁█▄█▃▄▂▂▆▃▄▂▂▁▁▁▁▁▁

Lattice                      600.14 µs/iter 604.25 µs      █▃
                    (575.50 µs … 683.46 µs) 643.92 µs      ██
                    (456.00  b … 294.45 kb) 876.32  b ▁▁▁▁▁███▅▅▇▃▃▂▂▁▁▁▁▁▁

Alien                        421.35 µs/iter 426.75 µs      █
                    (402.29 µs … 518.25 µs) 453.25 µs     ▄█▅   ▅
                    (504.00  b … 320.99 kb) 755.55  b ▁▁▁▂███▆▅██▄▂▃▂▂▁▂▁▁▁

                             ┌                                            ┐
                      Preact ┤ 421.12 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 600.14 µs
                       Alien ┤ 421.35 µs
                             └                                            ┘

summary
  Preact
   1x faster than Alien
   1.43x faster than Lattice
  ✓ Completed in 10.84s

Running: scaling-subscribers

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       16.88 µs/iter  15.75 µs █
                      (14.79 µs … 46.67 µs)  36.58 µs █▄▁▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   2.98 ms)   5.75 kb (456.00  b…106.27 kb)

Preact - 50 subscribers       29.72 µs/iter  28.92 µs  █
                      (26.46 µs … 81.42 µs)  60.29 µs ▅█▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   3.10 ms)   9.07 kb (456.00  b…270.13 kb)

Preact - 100 subscribers      50.66 µs/iter  50.99 µs            █
                      (49.51 µs … 51.37 µs)  51.28 µs ▆▁▆▁▁▁▁▁▁▁▁█▁▆▁▆▆▆▁▆▆
                  gc(  2.52 ms …   2.96 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     108.41 µs/iter 110.67 µs █   ▇
                    (102.54 µs … 148.46 µs) 142.38 µs ███▇█▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.50 ms …   2.87 ms)  22.33 kb (456.00  b…156.95 kb)

Preact - 400 subscribers     307.99 µs/iter 315.83 µs     ▅█▆
                    (278.79 µs … 382.29 µs) 364.38 µs ▃▃▅██████▇▇▄▄▂▃▂▁▁▁▂▁
                  gc(  1.42 ms …   2.91 ms)   6.12 kb (456.00  b…136.95 kb)

Lattice - 25 subscribers      18.03 µs/iter  17.25 µs  █
                      (15.00 µs … 53.71 µs)  41.42 µs ▅█▃▃▁▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁▁
                  gc(  1.57 ms …   3.24 ms)   6.01 kb (504.00  b…251.27 kb)

Lattice - 50 subscribers      30.10 µs/iter  30.18 µs           █  ▃      ▃
                      (29.71 µs … 30.63 µs)  30.26 µs ▆▁▁▁▁▁▁▁▆▁█▁▁█▁▆▁▆▁▁█
                  gc(  2.19 ms …   3.71 ms)  39.98  b (  0.10  b…478.52  b)

Lattice - 100 subscribers     67.21 µs/iter  67.83 µs     ▂█▅
                      (62.46 µs … 86.58 µs)  81.38 µs ▃▄▂▇███▂▁▁▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   2.96 ms)   5.24 kb (504.00  b…104.49 kb)

Lattice - 200 subscribers    125.18 µs/iter 124.79 µs  █
                    (123.00 µs … 166.67 µs) 144.21 µs ▂█▇▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.57 ms …   2.90 ms)  24.10 kb (504.00  b…156.99 kb)

Lattice - 400 subscribers    315.80 µs/iter 322.13 µs     █▄ ▄
                    (289.92 µs … 388.96 µs) 377.96 µs ▂▄▅███▇█▆▄▃▃▂▁▁▂▂▂▁▁▁
                  gc(  1.43 ms …   2.88 ms)   7.33 kb (504.00  b…116.49 kb)

Alien - 25 subscribers        14.22 µs/iter  13.33 µs █
                      (12.63 µs … 48.04 µs)  33.67 µs █▄▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   3.36 ms)   5.72 kb (440.00  b…109.32 kb)

Alien - 50 subscribers        25.24 µs/iter  25.27 µs       █
                      (25.11 µs … 25.41 µs)  25.39 µs ██▁▁▁██▁▁▁███▁▁▁▁▁▁▁█
                  gc(  2.10 ms …   3.50 ms)  19.31  b (  0.10  b…258.47  b)

Alien - 100 subscribers       51.23 µs/iter  51.75 µs █                  █
                      (50.65 µs … 52.14 µs)  51.81 µs ██▁▁████▁▁▁▁█▁▁▁▁▁▁██
                  gc(  2.57 ms …   4.49 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 200 subscribers      111.98 µs/iter 111.92 µs   █▃
                    (104.50 µs … 184.00 µs) 160.67 µs █▄██▂▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.58 ms …   3.85 ms)  11.18 kb (456.00  b…124.95 kb)

Alien - 400 subscribers      321.28 µs/iter 330.58 µs    ▆▆▃▅█▄▃
                    (287.79 µs … 394.08 µs) 381.92 µs ▂▃████████▇█▅▃▃▃▂▁▂▂▁
                  gc(  1.46 ms …   2.67 ms)   8.91 kb (456.00  b…116.45 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 16.88 µs
     Preact - 50 subscribers ┤■■ 29.72 µs
    Preact - 100 subscribers ┤■■■■ 50.66 µs
    Preact - 200 subscribers ┤■■■■■■■■■■ 108.41 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 307.99 µs
    Lattice - 25 subscribers ┤ 18.03 µs
    Lattice - 50 subscribers ┤■■ 30.10 µs
   Lattice - 100 subscribers ┤■■■■■■ 67.21 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■ 125.18 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 315.80 µs
      Alien - 25 subscribers ┤ 14.22 µs
      Alien - 50 subscribers ┤■ 25.24 µs
     Alien - 100 subscribers ┤■■■■ 51.23 µs
     Alien - 200 subscribers ┤■■■■■■■■■■■ 111.98 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 321.28 µs
                             └                                            ┘

summary
  Preact - $sources subscribers
   +1.04…-1.19x faster than Alien - $sources subscribers
   +1.03…+1.07x faster than Lattice - $sources subscribers
  ✓ Completed in 34.02s

Running: signal-updates

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          356.72 µs/iter 331.88 µs █
                    (313.96 µs … 620.17 µs) 584.25 µs █▆
                    (408.00  b … 256.45 kb) 997.07  b ██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂▁

Lattice - write only         235.54 µs/iter 407.00 µs █
                     (95.75 µs … 706.67 µs) 460.67 µs █                ▂
                    (120.00  b … 621.40 kb)   1.52 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▄▆▂

Alien - write only            71.62 µs/iter  47.75 µs █
                     (45.38 µs … 614.54 µs) 566.21 µs █
                    ( 48.00  b … 566.40 kb) 501.92  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           235.83 µs/iter 409.42 µs █
                     (94.67 µs … 483.21 µs) 449.04 µs █                 █
                    ( 48.00  b … 600.40 kb)   1.16 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▄▁

Lattice - read only          215.89 µs/iter 404.50 µs █
                     (38.58 µs … 472.67 µs) 430.21 µs █                  █
                    ( 48.00  b … 605.90 kb)   1.14 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅█▂

Alien - read only             93.00 µs/iter  61.88 µs █
                     (59.25 µs … 615.21 µs) 579.63 µs █
                    ( 32.00  b … 781.40 kb) 498.42  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    381.28 µs/iter 342.08 µs █
                    (331.50 µs … 891.75 µs) 853.13 µs █
                    (408.00  b … 334.99 kb)   1.03 kb █▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃▁

Lattice - read/write mixed   309.91 µs/iter 751.04 µs █
                     (94.67 µs … 880.67 µs) 828.17 µs █
                    ( 48.00  b … 685.40 kb)   1.26 kb █▁▁▁▁▁█▁▁▁▁▁▁▁▁▁▁▁▇▄▂

Alien - read/write mixed     349.99 µs/iter 207.75 µs █
                      (127.67 µs … 1.51 ms)   1.47 ms █
                    (408.00  b … 160.49 kb) 680.73  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 356.72 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 235.54 µs
          Alien - write only ┤ 71.62 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■ 235.83 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 215.89 µs
           Alien - read only ┤■■ 93.00 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 381.28 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.91 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 349.99 µs
                             └                                            ┘

summary
  Alien - write only
   1.3x faster than Alien - read only
   3.01x faster than Lattice - read only
   3.29x faster than Lattice - write only
   3.29x faster than Preact - read only
   4.33x faster than Lattice - read/write mixed
   4.89x faster than Alien - read/write mixed
   4.98x faster than Preact - write only
   5.32x faster than Preact - read/write mixed
  ✓ Completed in 10.80s

Running: sparse-updates

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   39.12 µs/iter  37.21 µs █▆
                     (35.21 µs … 132.50 µs)  90.46 µs ██▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.50 ms …   3.24 ms)   7.70 kb (456.00  b…185.21 kb)

Preact - 15% sparse updates   46.13 µs/iter  44.25 µs █
                      (43.21 µs … 84.08 µs)  70.42 µs █▅▁▁▂▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   3.05 ms)   8.23 kb (456.00  b…240.95 kb)

Preact - 20% sparse updates   56.96 µs/iter  57.51 µs █
                      (55.43 µs … 58.22 µs)  57.81 µs █▁▁▁▁▁█▁▁▁▁██▁█████▁█
                  gc(  2.43 ms …   3.02 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   75.73 µs/iter  75.96 µs   █
                     (71.50 µs … 118.13 µs) 106.50 µs ▆▇██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.52 ms)   8.23 kb (456.00  b…132.95 kb)

Lattice - 10% sparse updates  41.74 µs/iter  46.04 µs █▃    ▂
                     (34.79 µs … 120.58 µs)  70.63 µs ██▃▂▁▃██▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   3.73 ms)  12.59 kb (504.00  b…  1.70 mb)

Lattice - 15% sparse updates  58.69 µs/iter  64.88 µs ▅█        ▃
                      (52.04 µs … 96.54 µs)  79.00 µs ██▆▂▂▂▂▁▃▇█▄▁▂▁▁▁▁▁▁▁
                  gc(  1.40 ms …   3.01 ms)   8.29 kb (504.00  b…124.99 kb)

Lattice - 20% sparse updates  77.22 µs/iter  83.25 µs  █▂▂        ▆▃
                     (69.04 µs … 119.71 µs)  92.08 µs ████▃▁▁▂▁▁▄▆██▆▂▁▁▂▁▁
                  gc(  1.43 ms …   2.92 ms)   6.40 kb (504.00  b…124.99 kb)

Lattice - 25% sparse updates  88.31 µs/iter  88.96 µs ▅▃ █
                     (84.79 µs … 125.42 µs) 112.54 µs ██▆█▃▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   3.01 ms)  13.78 kb (504.00  b…132.99 kb)

Alien - 10% sparse updates    36.79 µs/iter  41.79 µs ▄█     ▅
                      (30.29 µs … 87.50 µs)  64.75 µs ██▂▃▂▁▆█▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.46 ms …   3.15 ms)  10.21 kb (456.00  b…514.11 kb)

Alien - 15% sparse updates    51.04 µs/iter  57.42 µs  █
                      (45.29 µs … 86.96 µs)  70.63 µs ▆█▅▂▁▁▁▁▂▄▆▅▂▁▁▁▁▁▁▁▁
                  gc(  1.44 ms …   2.34 ms)   6.34 kb (456.00  b…114.45 kb)

Alien - 20% sparse updates    56.80 µs/iter  56.90 µs                  █
                      (56.45 µs … 57.16 µs)  56.97 µs ██▁▁▁▁█▁▁█▁▁▁█▁███▁██
                  gc(  2.54 ms …   3.15 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    77.75 µs/iter  78.33 µs    ▅█
                     (73.54 µs … 112.92 µs)  96.04 µs ▇▇███▇▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.87 ms)   7.53 kb (456.00  b…124.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■ 39.12 µs
 Preact - 15% sparse updates ┤■■■■■■ 46.13 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■ 56.96 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 75.73 µs
Lattice - 10% sparse updates ┤■■■ 41.74 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■■ 58.69 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■ 77.22 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 88.31 µs
  Alien - 10% sparse updates ┤ 36.79 µs
  Alien - 15% sparse updates ┤■■■■■■■■■ 51.04 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■■ 56.80 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■ 77.75 µs
                             └                                            ┘

summary
  Preact - $changeRatio% sparse updates
   +1.03…-1.06x faster than Alien - $changeRatio% sparse updates
   +1.17…+1.07x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.44s

Running: wide-fanout

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       311.67 µs/iter 311.96 µs   █
                    (303.54 µs … 454.13 µs) 347.58 µs   █▃
                    ( 47.59 kb … 567.09 kb)  56.63 kb ▂▁██▆▄▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      251.61 µs/iter 252.08 µs   █
                    (244.08 µs … 418.08 µs) 278.92 µs   ██▂
                    ( 10.70 kb … 613.18 kb)  56.92 kb ▁▂███▇▅▃▂▃▁▂▁▁▁▁▁▁▁▁▁

Alien                        295.54 µs/iter 300.13 µs  █▂
                    (284.92 µs … 479.92 µs) 333.33 µs  ██
                    ( 14.88 kb … 564.18 kb)  56.80 kb ▁███▅▄▂▂▆▆▄▃▂▂▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 311.67 µs
                     Lattice ┤ 251.61 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■ 295.54 µs
                             └                                            ┘

summary
  Lattice
   1.17x faster than Alien
   1.24x faster than Preact

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       366.20 µs/iter 365.58 µs   █
                    (357.08 µs … 580.25 µs) 402.63 µs   █▄
                    (  5.87 kb …   1.26 mb)   7.88 kb ▁▁██▆▄▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      195.47 µs/iter 197.00 µs  █
                    (189.33 µs … 436.79 µs) 249.88 µs  █
                    (  5.59 kb … 605.50 kb)   8.15 kb ▁█▇█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        299.49 µs/iter 299.83 µs ▂█
                    (292.63 µs … 401.46 µs) 351.08 µs ██▂
                    (  5.52 kb … 549.87 kb)   7.91 kb ███▅▆▃▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 366.20 µs
                     Lattice ┤ 195.47 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■ 299.49 µs
                             └                                            ┘

summary
  Lattice
   1.53x faster than Alien
   1.87x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       259.77 µs/iter 261.79 µs   █
                    (252.38 µs … 376.58 µs) 289.04 µs   █
                    (  5.59 kb … 485.87 kb)   7.13 kb ▁▃██▄▃▃▇▂▁▁▁▂▁▁▁▁▁▁▁▁

Lattice                       92.43 µs/iter  91.92 µs  █
                     (89.75 µs … 362.75 µs) 116.25 µs  █
                    (  2.37 kb … 549.96 kb)   7.57 kb ▂█▃▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        273.39 µs/iter 277.25 µs   █
                    (262.17 µs … 361.00 µs) 304.54 µs  ▆█▄ ▃ ▆▂
                    (  2.96 kb … 382.96 kb)   7.51 kb ▂███▆█▇██▅▃▃▂▂▂▂▂▂▁▁▂

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 259.77 µs
                     Lattice ┤ 92.43 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 273.39 µs
                             └                                            ┘

summary
  Lattice
   2.81x faster than Preact
   2.96x faster than Alien
  ✓ Completed in 10.83s

Running: write-heavy

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        55.01 µs/iter  54.42 µs  █
                     (53.46 µs … 137.50 µs)  64.92 µs  █
                    ( 32.00  b … 996.42 kb) 971.66  b ▂█▆▂▃▂▂▁▁▁▁▁▁▁▂▁▁▁▁▁▁

Lattice                      145.41 µs/iter 143.83 µs   █
                    (137.42 µs … 637.42 µs) 188.58 µs  ██
                    ( 32.00  b … 622.99 kb)   1.98 kb ▆██▆▃▂▂▄▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien                         46.54 µs/iter  45.75 µs █
                     (43.75 µs … 285.25 µs)  86.46 µs █▇
                    ( 32.00  b … 726.78 kb) 658.74  b ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 55.01 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 145.41 µs
                       Alien ┤ 46.54 µs
                             └                                            ┘

summary
  Alien
   1.18x faster than Preact
   3.12x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        49.11 µs/iter  48.21 µs  █
                      (47.29 µs … 93.92 µs)  66.67 µs  █
                    ( 32.00  b … 265.49 kb) 838.42  b ▂█▄▂▂▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      134.50 µs/iter 135.96 µs   █
                    (130.33 µs … 186.29 µs) 147.21 µs   █
                    ( 48.00  b … 664.99 kb)   2.07 kb ▁▁█▃▂▄▂▆▃▂▂▁▁▂▃▁▁▁▁▁▁

Alien                         40.40 µs/iter  39.17 µs  █
                      (37.79 µs … 96.63 µs)  78.79 µs  █
                    ( 32.00  b … 227.40 kb) 592.12  b ▁█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 49.11 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 134.50 µs
                       Alien ┤ 40.40 µs
                             └                                            ┘

summary
  Alien
   1.22x faster than Preact
   3.33x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        95.49 µs/iter  96.13 µs  █
                     (92.13 µs … 247.00 µs) 119.08 µs  █
                    (472.00  b … 663.81 kb)   6.82 kb ▁█▃▇▃▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      188.80 µs/iter 187.50 µs  █
                    (178.75 µs … 294.17 µs) 236.50 µs  █
                    (  4.96 kb …   1.21 mb)   7.73 kb ▁█▇█▂▂▂▂▁▁▁▁▃▂▂▁▁▁▁▁▁

Alien                        137.78 µs/iter 138.42 µs  █▃
                    (133.42 µs … 233.33 µs) 160.88 µs  ██
                    (  3.87 kb … 672.07 kb)   7.06 kb ▂██▆▇▄▂▄▂▂▂▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 95.49 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 188.80 µs
                       Alien ┤■■■■■■■■■■■■■■■ 137.78 µs
                             └                                            ┘

summary
  Preact
   1.44x faster than Alien
   1.98x faster than Lattice
  ✓ Completed in 10.86s

Summary:
  Total: 12
  Success: 12
  Failed: 0