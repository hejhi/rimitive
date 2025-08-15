Found 12 benchmark suites

Running: batch-operations

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       546.94 µs/iter 542.13 µs    █
                    (520.88 µs … 695.75 µs) 641.29 µs    █
                    (461.30 kb …   1.32 mb) 938.22 kb ▁▁▁█▃▃▂▂▁▁▁▁▁▁▁▁▂▁▁▁▁

Lattice                      723.96 µs/iter 722.67 µs  █
                    (709.67 µs … 861.96 µs) 814.38 µs  █
                    (478.41 kb …   1.36 mb) 937.80 kb ▅█▆▂▁▆▂▁▁▁▁▁▁▁▁▂▂▁▁▁▁

Alien                        423.66 µs/iter 423.79 µs       █▂
                    (406.42 µs … 588.83 µs) 449.54 µs       ██▅
                    (456.00  b … 352.99 kb) 968.16  b ▁▁▁▁▁▁███▅▃▂▄▃▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■ 546.94 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 723.96 µs
                       Alien ┤ 423.66 µs
                             └                                            ┘

summary
  Alien
   1.29x faster than Preact
   1.71x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       130.84 µs/iter 128.88 µs  █
                    (124.00 µs … 401.54 µs) 210.08 µs  █
                    ( 11.62 kb … 717.66 kb) 204.47 kb ▁█▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      254.76 µs/iter 253.58 µs   █
                    (243.21 µs … 522.79 µs) 336.83 µs   █
                    ( 40.80 kb …   1.20 mb) 205.67 kb ▁▁█▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        220.13 µs/iter 219.79 µs  █
                    (214.83 µs … 388.88 µs) 291.46 µs  █
                    ( 20.89 kb … 747.47 kb) 149.97 kb ▁█▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 130.84 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 254.76 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■ 220.13 µs
                             └                                            ┘

summary
  Preact
   1.68x faster than Alien
   1.95x faster than Lattice

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       416.27 µs/iter 414.00 µs   █
                    (398.83 µs … 563.71 µs) 509.58 µs   █▇
                    (162.23 kb …   1.11 mb) 516.83 kb ▁▁██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      552.69 µs/iter 547.58 µs   █
                    (529.83 µs … 774.25 µs) 650.29 µs   ██
                    (179.73 kb …   2.44 mb)   1.11 mb ▁▂██▃▃▁▁▁▁▁▁▁▁▁▂▂▂▁▁▁

Alien                        482.20 µs/iter 481.46 µs  █
                    (473.21 µs … 684.33 µs) 550.83 µs  ██
                    ( 71.15 kb … 693.87 kb) 111.09 kb ▁██▅▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 416.27 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 552.69 µs
                       Alien ┤■■■■■■■■■■■■■■■■ 482.20 µs
                             └                                            ┘

summary
  Preact
   1.16x faster than Alien
   1.33x faster than Lattice
  ✓ Completed in 10.78s

Running: computed-chains

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       405.75 µs/iter 407.88 µs    █
                    (394.04 µs … 461.92 µs) 436.92 µs    █
                    (408.00  b … 288.45 kb) 826.25  b ▁▁▁██▄▃▂▂▆▂▂▁▁▁▁▁▁▁▁▁

Lattice                      524.01 µs/iter 521.21 µs  █
                    (512.25 µs … 654.92 µs) 606.88 µs  █▅
                    (625.55 kb …   1.36 mb) 626.68 kb ▁██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▂▁▁▁

Alien                        362.00 µs/iter 354.08 µs █▅
                    (348.54 µs … 438.83 µs) 431.92 µs ██
                    (408.00  b … 264.49 kb) 947.80  b ██▄▃▁▂▁▁▁▁▁▁▁▁▁▁▁▁▅▄▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■ 405.75 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 524.01 µs
                       Alien ┤ 362.00 µs
                             └                                            ┘

summary
  Alien
   1.12x faster than Preact
   1.45x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       217.43 µs/iter 218.83 µs   █
                    (210.50 µs … 305.79 µs) 238.29 µs   █   █
                    (120.00  b … 381.90 kb)   1.42 kb ▁▁█▁▅▁█▇▃▂▁▂▂▁▁▁▁▁▁▁▁

Lattice                      271.84 µs/iter 272.00 µs  █▅
                    (261.54 µs … 492.50 µs) 347.50 µs  ██▂
                    ( 89.96 kb …   1.17 mb) 563.73 kb ▂███▂▁▁▁▁▁▁▁▁▁▁▁▁▁▂▁▁

Alien                        221.40 µs/iter 224.54 µs       █
                    (211.71 µs … 283.96 µs) 235.88 µs      ▃█▄   ▆
                    ( 48.00  b … 445.90 kb)   1.80 kb ▁▁▁▂▁███▄▅▂█▃▃▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 217.43 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 271.84 µs
                       Alien ┤■■ 221.40 µs
                             └                                            ┘

summary
  Preact
   1.02x faster than Alien
   1.25x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       110.16 µs/iter 109.58 µs     █
                    (105.88 µs … 256.79 µs) 124.42 µs    ▂█
                    (120.00  b …   1.26 mb)   1.04 kb ▁▁▁██▁▂▃▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      128.65 µs/iter 128.00 µs  █
                    (121.46 µs … 442.29 µs) 208.71 µs  █
                    (  1.70 kb … 720.30 kb) 307.04 kb ▁█▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        107.69 µs/iter 108.25 µs      █
                    (103.96 µs … 316.46 µs) 114.00 µs      █
                    ( 32.00  b … 259.40 kb)   1.06 kb ▁▁▁▁▃██▃▁▁▂▄▃▂▃▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■ 110.16 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 128.65 µs
                       Alien ┤ 107.69 µs
                             └                                            ┘

summary
  Alien
   1.02x faster than Preact
   1.19x faster than Lattice
  ✓ Completed in 10.81s

Running: conditional-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       583.08 µs/iter 578.79 µs  █▃
                    (568.21 µs … 725.04 µs) 666.33 µs  ██
                    ( 79.23 kb …   1.33 mb) 859.68 kb ▁██▅▂▂▁▁▁▁▁▁▁▁▁▁▂▂▂▁▁

Lattice                      583.99 µs/iter 590.17 µs  █
                    (569.96 µs … 665.67 µs) 639.00 µs ▇█
                    (504.00  b … 747.49 kb)   1.70 kb ███▅▆▄▄▄▃▃▂▄▃▂▁▁▁▁▂▂▁

Alien                        996.56 µs/iter 561.92 µs █
                     (529.88 µs … 12.58 ms)  11.52 ms █
                    (  9.88 kb … 838.73 kb) 701.01 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 583.08 µs
                     Lattice ┤ 583.99 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 996.56 µs
                             └                                            ┘

summary
  Preact
   1x faster than Lattice
   1.71x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       914.09 µs/iter 909.25 µs  █
                      (899.08 µs … 1.10 ms)   1.02 ms  █
                    (164.39 kb …   1.35 mb) 858.51 kb ██▆▂▂▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                        1.24 ms/iter   1.24 ms  █
                        (1.23 ms … 1.39 ms)   1.30 ms ██
                    (504.00  b … 673.99 kb)   1.69 kb ███▄▂▂▂▂▁▂▁▁▃▁▁▁▁▁▁▁▁

Alien                          1.28 ms/iter 862.71 µs █
                     (844.58 µs … 12.09 ms)  11.53 ms █
                    (297.75 kb …   1.09 mb) 702.71 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 914.09 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.24 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.28 ms
                             └                                            ┘

summary
  Preact
   1.36x faster than Lattice
   1.4x faster than Alien
  ✓ Completed in 8.65s

Running: dense-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   165.84 µs/iter 167.58 µs    █
                    (158.17 µs … 246.67 µs) 187.67 µs ▂▄▆█▆▄▅▃▃▃▂▂▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   4.23 ms)  10.78 kb (456.00  b…  1.25 mb)

Preact - 75% dense updates   226.54 µs/iter 224.92 µs  █
                    (223.38 µs … 349.21 µs) 254.46 µs ██▁▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.35 ms …   3.57 ms)  13.87 kb (456.00  b…861.99 kb)

Preact - 90% dense updates   285.94 µs/iter 291.08 µs          █
                    (272.67 µs … 322.79 µs) 307.83 µs ▄██▇▅▂▂▂▆██▅▅▅▃▃▂▁▁▁▁
                  gc(  1.39 ms …   2.76 ms)   2.87 kb (456.00  b… 84.45 kb)

Preact - 100% dense updates  312.96 µs/iter 316.75 µs   ▂     █▄
                    (300.13 µs … 341.54 µs) 331.08 µs ▃▅█▁▁▁▁▁██▇▆▅▄▄▂▂▁▁▁▁
                  gc(  1.36 ms …   3.77 ms)   2.93 kb (456.00  b… 72.45 kb)

Lattice - 50% dense updates  183.23 µs/iter 182.25 µs ▂█
                    (180.75 µs … 262.00 µs) 204.38 µs ██▃▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.50 ms …   4.13 ms) 183.37 kb ( 53.41 kb…  2.28 mb)

Lattice - 75% dense updates  291.64 µs/iter 293.88 µs      █
                    (274.79 µs … 389.42 µs) 328.79 µs ▂▃▁▂▃██▅▅▂▂▂▁▁▁▁▁▁▁▁▁
                  gc(  1.35 ms …   2.41 ms) 145.37 kb (110.98 kb…538.67 kb)

Lattice - 90% dense updates  343.81 µs/iter 346.63 µs         ▂█▄
                    (326.42 µs … 372.29 µs) 365.33 µs ▂▄▃▂▂▁▂▄███▅▅▄▂▂▁▁▁▁▂
                  gc(  1.38 ms …   2.83 ms) 210.74 kb (157.91 kb…333.23 kb)

Lattice - 100% dense updates 373.87 µs/iter 377.21 µs           █
                    (357.63 µs … 397.04 µs) 390.00 µs ▂▄▄▂▂▁▁▁▂▇██▆▅▄▃▂▂▂▂▁
                  gc(  1.32 ms …   2.43 ms) 217.87 kb (169.72 kb…465.55 kb)

Alien - 50% dense updates    153.01 µs/iter 157.08 µs   ▂█
                    (143.33 µs … 233.79 µs) 179.83 µs ▁▆██▅▄▅▆▇▅▄▃▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   5.03 ms)  31.67 kb (504.00  b…  1.08 mb)

Alien - 75% dense updates    251.44 µs/iter 254.83 µs      █▇▅▂
                    (231.50 µs … 322.25 µs) 288.67 µs ▂▃▃▄▅████▇▄▄▃▁▂▁▂▁▁▁▁
                  gc(  1.43 ms …   2.67 ms)  21.14 kb (504.00  b…216.45 kb)

Alien - 90% dense updates    266.13 µs/iter 272.33 µs  █
                    (254.83 µs … 301.50 µs) 285.63 µs ▆█▃▂▂▁▁▁▂██▅▅▃▃▃▂▂▂▁▁
                  gc(  1.43 ms …   2.86 ms)   6.20 kb (504.00  b…122.99 kb)

Alien - 100% dense updates   299.56 µs/iter 302.21 µs         █
                    (284.04 µs … 329.92 µs) 323.38 µs ▂▃▃▂▄▃▃▆██▄▄▃▂▁▁▁▁▁▁▁
                  gc(  1.40 ms …   2.81 ms)   2.18 kb (504.00  b… 40.49 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■ 165.84 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■ 226.54 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■ 285.94 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■ 312.96 µs
 Lattice - 50% dense updates ┤■■■■■ 183.23 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 291.64 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 343.81 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 373.87 µs
   Alien - 50% dense updates ┤ 153.01 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■■■■■ 251.44 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■ 266.13 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 299.56 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.04…+1.08x faster than Preact - $changeRatio% dense updates
   +1.25…+1.2x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.41s

Running: diamond-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       639.91 µs/iter 640.29 µs    ▃█
                    (630.88 µs … 707.67 µs) 670.17 µs   ███▂
                    (456.00  b … 169.71 kb) 716.67  b ▁▁████▃▂▂▁▁▁▁▂▃▂▁▁▁▁▁

Lattice                        1.13 ms/iter   1.13 ms   █
                        (1.10 ms … 1.27 ms)   1.21 ms  ▃██▃
                    (647.03 kb …   1.82 mb)   1.22 mb ▂████▅▂▁▁▁▂▁▁▁▂▂▂▂▁▁▁

Alien                        578.30 µs/iter 578.42 µs  █
                    (572.25 µs … 676.04 µs) 621.21 µs  █▅
                    (504.00  b … 316.99 kb) 772.17  b ▁███▄▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■ 639.91 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.13 ms
                       Alien ┤ 578.30 µs
                             └                                            ┘

summary
  Alien
   1.11x faster than Preact
   1.95x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       309.54 µs/iter 310.08 µs    █
                    (301.92 µs … 478.38 µs) 333.50 µs    █ ▄
                    ( 16.76 kb … 567.09 kb)  56.53 kb ▁▁▄█▇█▃▃▂▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      240.46 µs/iter 239.96 µs  █
                    (234.29 µs … 501.83 µs) 317.29 µs  █
                    ( 52.10 kb …   1.08 mb) 182.12 kb ▁█▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        290.92 µs/iter 291.04 µs   █
                    (283.46 µs … 429.79 µs) 320.75 µs   █▆
                    ( 15.09 kb … 567.09 kb)  56.62 kb ▁▁██▆▂▂▆▂▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.54 µs
                     Lattice ┤ 240.46 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■ 290.92 µs
                             └                                            ┘

summary
  Lattice
   1.21x faster than Alien
   1.29x faster than Preact

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       737.28 µs/iter 738.33 µs    █
                    (723.08 µs … 783.87 µs) 772.88 µs    ██
                    (488.00  b … 903.08 kb)   1.68 kb ▁▁▁██▇▃▂▁▁▂▁█▄▂▁▁▁▁▁▁

Lattice                      943.83 µs/iter 954.00 µs  █▇
                      (918.29 µs … 1.14 ms)   1.06 ms  ██
                    (447.48 kb …   3.22 mb)   1.22 mb ▁██▅▂▇▅▂▂▁▁▁▃▂▂▁▁▁▁▁▁

Alien                        611.06 µs/iter 608.96 µs  █
                    (599.21 µs … 798.25 µs) 720.54 µs  █▄
                    ( 44.87 kb …   1.58 mb) 393.37 kb ▁██▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■ 737.28 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 943.83 µs
                       Alien ┤ 611.06 µs
                             └                                            ┘

summary
  Alien
   1.21x faster than Preact
   1.54x faster than Lattice
  ✓ Completed in 10.80s

Running: effect-triggers

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       318.31 µs/iter 317.92 µs       █
                    (278.67 µs … 597.88 µs) 405.00 µs       █
                    (648.00  b …   1.99 mb) 157.34 kb ▁▁▁▁▁▁█▆▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      376.30 µs/iter 375.38 µs   █
                    (359.96 µs … 540.75 µs) 458.42 µs   █▇
                    (504.00  b …   1.09 mb) 155.50 kb ▁▁██▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        268.13 µs/iter 265.21 µs      █
                    (231.00 µs … 523.79 µs) 345.33 µs      █▄
                    (504.00  b …   2.20 mb) 157.76 kb ▁▁▁▁▁██▂▁▁▆▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■ 318.31 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 376.30 µs
                       Alien ┤ 268.13 µs
                             └                                            ┘

summary
  Alien
   1.19x faster than Preact
   1.4x faster than Lattice

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          223.82 µs/iter 239.46 µs  █
                    (206.38 µs … 314.42 µs) 248.29 µs  █              █
                    (120.00  b … 397.07 kb)   1.51 kb ▁█▃▄▂▁▁▁▁▁▁▁▁▁▆▂█▄▁▂▁

Lattice - 10 effects         288.53 µs/iter 290.38 µs   █
                    (281.29 µs … 824.08 µs) 310.92 µs   █
                    ( 48.00  b … 573.90 kb)   2.11 kb ▁▂█▅▆▇▃▃▇▂▂▂▂▁▁▁▁▁▁▁▁

Alien - 10 effects           222.79 µs/iter 223.04 µs   █
                    (217.46 µs … 305.04 µs) 244.25 µs   █▆
                    (104.00  b … 474.49 kb)   1.47 kb ▂▁███▃▂▆▂▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤■ 223.82 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 288.53 µs
          Alien - 10 effects ┤ 222.79 µs
                             └                                            ┘

summary
  Alien - 10 effects
   1x faster than Preact - 10 effects
   1.3x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         8.38 µs/iter   8.21 µs      █
                      (7.92 µs … 138.58 µs)   8.92 µs    ▃▇█▄
                    (312.00  b … 479.77 kb)  20.63 kb ▁▁▂████▆▄▂▃▂▂▁▁▁▁▁▁▁▁

Lattice                       12.07 µs/iter   8.25 µs  █
                        (7.71 µs … 2.67 ms)  18.67 µs ▅█
                    (  1.07 kb … 551.36 kb)  23.80 kb ██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          6.32 µs/iter   6.21 µs      █
                      (5.92 µs … 164.75 µs)   6.83 µs      █
                    (728.00  b … 247.55 kb)  19.75 kb ▁▁▂▅▆█▄▃▃▃▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■ 8.38 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 12.07 µs
                       Alien ┤ 6.32 µs
                             └                                            ┘

summary
  Alien
   1.33x faster than Preact
   1.91x faster than Lattice
  ✓ Completed in 10.89s

Running: filtered-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        298.43 µs/iter 313.42 µs  █
                    (283.96 µs … 343.46 µs) 333.21 µs  █
                    (120.00  b … 437.90 kb)   1.50 kb ▁█▄▆▂▂▁▁▂▁▁▁▅▂▁▁▁▅▃▂▁

Lattice - 90% filtered       485.23 µs/iter 481.46 µs █
                    (476.88 µs … 634.71 µs) 580.71 µs █▂
                    ( 71.59 kb …   1.04 mb) 625.55 kb ██▃▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien - 90% filtered         295.96 µs/iter 286.08 µs  █
                    (279.50 µs … 411.75 µs) 365.33 µs  █
                    ( 48.00  b … 480.40 kb)   1.42 kb ▁█▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂▁

                             ┌                                            ┐
       Preact - 90% filtered ┤ 298.43 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 485.23 µs
        Alien - 90% filtered ┤ 295.96 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1.01x faster than Preact - 90% filtered
   1.64x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       869.68 µs/iter 875.96 µs   █▆
                      (840.17 µs … 1.09 ms) 991.75 µs   ██
                    (114.65 kb … 238.47 kb) 234.72 kb ▂███▇▅█▅▂▂▂▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter        1.08 ms/iter   1.08 ms   █
                        (1.05 ms … 1.26 ms)   1.19 ms  ▃█
                    (874.51 kb …   2.05 mb)   1.45 mb ▁███▄▂▂▄▂▁▂▁▂▃▂▁▁▁▁▁▁

Alien - toggle filter        779.76 µs/iter 790.50 µs     █
                    (746.33 µs … 930.13 µs) 868.21 µs     █
                    (196.15 kb … 541.87 kb) 235.48 kb ▁▁▃██▅▃▅▇▃▂▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■■■■ 869.68 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.08 ms
       Alien - toggle filter ┤ 779.76 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.12x faster than Preact - toggle filter
   1.38x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       420.82 µs/iter 426.37 µs    █
                    (411.13 µs … 480.04 µs) 446.17 µs    █
                    (504.00  b … 240.99 kb) 698.37  b ▁▁▁█▆▄▃▂▁▇▄▂▂▁▁▁▁▁▁▁▁

Lattice                      704.62 µs/iter 704.17 µs  █
                    (685.71 µs … 883.33 µs) 815.04 µs  █▄
                    (354.12 kb …   1.86 mb)   1.22 mb ▄███▃▂▂▁▁▁▁▁▂▂▂▁▁▁▁▁▁

Alien                        425.68 µs/iter 430.25 µs █
                    (415.50 µs … 511.58 µs) 475.58 µs █▄   ▃
                    (504.00  b … 346.49 kb) 854.89  b ██▃▂▅█▃▂▂▂▂▁▁▁▁▃▂▁▁▁▂

                             ┌                                            ┐
                      Preact ┤ 420.82 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 704.62 µs
                       Alien ┤■ 425.68 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.67x faster than Lattice
  ✓ Completed in 10.81s

Running: scaling-subscribers

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       16.89 µs/iter  15.42 µs █
                      (14.88 µs … 50.58 µs)  35.88 µs █▂▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.50 ms …   2.65 ms)   6.08 kb (456.00  b…170.27 kb)

Preact - 50 subscribers       29.35 µs/iter  28.58 µs  █
                      (26.71 µs … 79.46 µs)  48.46 µs ▇██▁▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.32 ms …   2.61 ms)  13.26 kb (456.00  b…520.01 kb)

Preact - 100 subscribers      51.64 µs/iter  51.68 µs       █ █
                      (50.00 µs … 54.77 µs)  54.40 µs ██▁██████▁▁▁▁▁▁▁▁▁▁▁█
                  gc(  2.45 ms …   3.99 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     108.59 µs/iter 112.00 µs  █
                    (104.58 µs … 128.42 µs) 115.63 µs ██▄▂▂▂▅▂▄▄▃▃▃▃█▆▃▂▁▁▁
                  gc(  1.38 ms …   2.99 ms)  25.86 kb (440.00  b…124.95 kb)

Preact - 400 subscribers     307.93 µs/iter 312.58 µs        █▄▃▂▃
                    (286.42 µs … 338.17 µs) 332.50 µs ▂▁▂▄▅▆██████▆▆▆▄▃▂▂▂▂
                  gc(  1.35 ms …   2.28 ms)   2.60 kb (456.00  b…116.45 kb)

Lattice - 25 subscribers      17.84 µs/iter  16.92 µs █
                      (15.92 µs … 70.83 µs)  36.33 µs ██▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   3.28 ms)  18.10 kb (  5.62 kb…256.40 kb)

Lattice - 50 subscribers      36.85 µs/iter  33.88 µs █
                     (33.17 µs … 183.79 µs) 168.29 µs █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.44 ms …   3.08 ms)  36.88 kb (120.00  b…751.80 kb)

Lattice - 100 subscribers     66.04 µs/iter  66.00 µs  █▂
                      (65.42 µs … 77.42 µs)  70.00 µs ▄██▅▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.55 ms …   3.12 ms)  61.64 kb ( 36.24 kb…189.24 kb)

Lattice - 200 subscribers    144.83 µs/iter 147.21 µs         █
                    (134.21 µs … 168.83 µs) 166.00 µs ▆▇▂▂▂▄▇▆█▂▂▁▁▁▁▁▂▂▂▂▂
                  gc(  1.48 ms …   2.72 ms) 136.79 kb ( 68.49 kb…269.49 kb)

Lattice - 400 subscribers    336.81 µs/iter 342.67 µs     ▂▅█▇▆▂▂
                    (315.21 µs … 375.58 µs) 367.92 µs ▂▂▄▇███████▆█▇▄▃▃▂▃▁▁
                  gc(  1.44 ms …   2.77 ms) 150.85 kb ( 50.38 kb…276.95 kb)

Alien - 25 subscribers        14.52 µs/iter  13.67 µs █
                      (13.04 µs … 44.00 µs)  29.50 µs █▆▁▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.56 ms …   2.98 ms)   5.31 kb (504.00  b…138.82 kb)

Alien - 50 subscribers        25.40 µs/iter  25.51 µs █ ███ █       █ █   █
                      (25.23 µs … 25.62 µs)  25.58 µs █▁███▁█▁▁▁▁▁▁▁█▁█▁▁▁█
                  gc(  2.07 ms …   2.46 ms)  16.91  b (  0.10  b…208.09  b)

Alien - 100 subscribers       50.51 µs/iter  50.61 µs █       █ █
                      (50.23 µs … 51.05 µs)  50.98 µs ███▁██▁▁█▁█▁▁▁▁▁▁▁▁▁█
                  gc(  2.59 ms …   3.96 ms)   0.11  b (  0.10  b…  0.12  b)

Alien - 200 subscribers      111.04 µs/iter 112.46 µs              ▃█▅
                    (105.33 µs … 135.00 µs) 115.29 µs ▂▃▂▁▃▅▄▅▅▆▇█▇███▅▂▁▂▂
                  gc(  1.45 ms …   2.86 ms)  26.40 kb (504.00  b…156.99 kb)

Alien - 400 subscribers      301.98 µs/iter 307.42 µs        █▆▃
                    (280.58 µs … 341.71 µs) 327.13 µs ▂▂▂▄▆▄▆████▆▅▆▄▄▄▂▂▂▂
                  gc(  1.48 ms …   2.94 ms)   2.80 kb (504.00  b… 51.99 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 16.89 µs
     Preact - 50 subscribers ┤■■ 29.35 µs
    Preact - 100 subscribers ┤■■■■ 51.64 µs
    Preact - 200 subscribers ┤■■■■■■■■■■ 108.59 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 307.93 µs
    Lattice - 25 subscribers ┤ 17.84 µs
    Lattice - 50 subscribers ┤■■ 36.85 µs
   Lattice - 100 subscribers ┤■■■■■ 66.04 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■■■ 144.83 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 336.81 µs
      Alien - 25 subscribers ┤ 14.52 µs
      Alien - 50 subscribers ┤■ 25.40 µs
     Alien - 100 subscribers ┤■■■■ 50.51 µs
     Alien - 200 subscribers ┤■■■■■■■■■■ 111.04 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 301.98 µs
                             └                                            ┘

summary
  Alien - $sources subscribers
   +1.02…+1.16x faster than Preact - $sources subscribers
   +1.12…+1.23x faster than Lattice - $sources subscribers
  ✓ Completed in 32.77s

Running: signal-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          354.28 µs/iter 328.25 µs █
                    (315.96 µs … 604.21 µs) 574.25 µs █
                    (408.00  b … 354.23 kb)   1.06 kb █▇▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂

Lattice - write only         234.33 µs/iter 403.54 µs █
                     (95.75 µs … 481.33 µs) 455.88 µs █                ▅
                    (120.00  b … 557.40 kb)   1.38 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▂▄▃

Alien - write only            71.26 µs/iter  47.42 µs █
                     (45.88 µs … 620.46 µs) 565.17 µs █
                    ( 32.00  b … 685.40 kb) 485.39  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           244.32 µs/iter 403.88 µs █
                     (95.75 µs … 491.21 µs) 425.38 µs █                  ▇
                    ( 48.00  b … 429.66 kb)   1.22 kb █▁▁▁▁▁▁▁█▁▁▁▁▁▁▁▁▁▁█▇

Lattice - read only          215.50 µs/iter 403.83 µs █                  ▂
                     (39.00 µs … 447.33 µs) 430.58 µs █                  █
                    ( 48.00  b … 429.40 kb)   0.98 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▄█▂

Alien - read only             92.37 µs/iter  60.08 µs █
                     (59.25 µs … 629.33 µs) 584.50 µs █
                    ( 48.00  b … 717.40 kb) 476.37  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    380.03 µs/iter 338.08 µs █
                    (325.29 µs … 851.04 µs) 830.79 µs █
                    (408.00  b … 309.61 kb)   0.98 kb ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▄

Lattice - read/write mixed   309.12 µs/iter 751.79 µs █
                     (95.75 µs … 804.54 µs) 789.13 µs █
                    ( 48.00  b … 632.90 kb)   1.44 kb █▁▁▁▁▁▆▄▁▁▁▁▁▁▁▁▁▁▁▇▅

Alien - read/write mixed     349.21 µs/iter 207.63 µs █
                      (126.29 µs … 1.47 ms)   1.44 ms █
                    (408.00  b … 160.49 kb) 679.92  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 354.28 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 234.33 µs
          Alien - write only ┤ 71.26 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■■ 244.32 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 215.50 µs
           Alien - read only ┤■■ 92.37 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 380.03 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.12 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 349.21 µs
                             └                                            ┘

summary
  Alien - write only
   1.3x faster than Alien - read only
   3.02x faster than Lattice - read only
   3.29x faster than Lattice - write only
   3.43x faster than Preact - read only
   4.34x faster than Lattice - read/write mixed
   4.9x faster than Alien - read/write mixed
   4.97x faster than Preact - write only
   5.33x faster than Preact - read/write mixed
  ✓ Completed in 10.79s

Running: sparse-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   38.08 µs/iter  36.46 µs ▆█
                     (34.83 µs … 110.21 µs)  76.21 µs ██▂▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   3.23 ms)  16.21 kb (456.00  b…691.64 kb)

Preact - 15% sparse updates   45.29 µs/iter  43.96 µs █
                      (43.08 µs … 78.21 µs)  68.46 µs █▅▁▁▁▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.33 ms …   2.94 ms)   7.72 kb (456.00  b…242.27 kb)

Preact - 20% sparse updates   56.47 µs/iter  57.00 µs █           █  █
                      (55.27 µs … 57.46 µs)  57.17 µs ██▁▁▁▁▁▁▁▁▁▁█▁▁█▁████
                  gc(  2.55 ms …   3.08 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   72.42 µs/iter  72.17 µs  █
                      (71.29 µs … 95.54 µs)  80.21 µs ▄██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.31 ms …   3.03 ms)   9.81 kb (456.00  b…132.95 kb)

Lattice - 10% sparse updates  38.38 µs/iter  37.00 µs █
                      (36.46 µs … 90.83 µs)  78.71 µs █▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   3.05 ms)  39.91 kb (  3.24 kb…  1.35 mb)

Lattice - 15% sparse updates  55.49 µs/iter  55.04 µs  █
                      (54.46 µs … 80.67 µs)  61.46 µs ▃█▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▂▁▁▁
                  gc(  1.37 ms …   2.73 ms)  56.32 kb ( 13.35 kb…171.87 kb)

Lattice - 20% sparse updates  74.15 µs/iter  75.54 µs  █▃
                      (72.58 µs … 87.00 µs)  79.83 µs ▃██▄▂▁▁▂▄▆▅▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.75 ms)  77.21 kb ( 42.49 kb…195.49 kb)

Lattice - 25% sparse updates  96.88 µs/iter  96.29 µs      █
                     (91.04 µs … 110.29 µs) 109.17 µs ▃▄▂▂▆██▁▁▂▁▁▁▁▁▂▂▂▂▂▁
                  gc(  1.37 ms …   2.77 ms)  99.17 kb ( 78.55 kb…203.12 kb)

Alien - 10% sparse updates    30.53 µs/iter  29.79 µs █
                      (29.17 µs … 81.38 µs)  58.33 µs █▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.46 ms …   3.08 ms)   7.66 kb (456.00  b…256.66 kb)

Alien - 15% sparse updates    43.88 µs/iter  43.83 µs  █
                      (43.38 µs … 57.17 µs)  50.96 µs ██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   3.02 ms)   5.63 kb (456.00  b…124.95 kb)

Alien - 20% sparse updates    56.09 µs/iter  55.76 µs      ██
                      (55.07 µs … 60.60 µs)  57.17 µs ██▁██████▁▁▁▁▁▁▁▁▁▁▁█
                  gc(  2.56 ms …   5.62 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    75.94 µs/iter  76.79 µs          ▂█▆
                      (72.63 µs … 92.83 µs)  80.21 µs ▄█▅▂▂▁▃▄████▇▄▂▂▂▂▂▂▁
                  gc(  1.41 ms …   2.93 ms)   7.55 kb (456.00  b…132.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■■■ 38.08 µs
 Preact - 15% sparse updates ┤■■■■■■■■ 45.29 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■ 56.47 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■ 72.42 µs
Lattice - 10% sparse updates ┤■■■■ 38.38 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■ 55.49 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■ 74.15 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 96.88 µs
  Alien - 10% sparse updates ┤ 30.53 µs
  Alien - 15% sparse updates ┤■■■■■■■ 43.88 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■■ 56.09 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 75.94 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   -1.05…+1.25x faster than Preact - $changeRatio% sparse updates
   +1.28…+1.26x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.36s

Running: wide-fanout

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       308.24 µs/iter 309.25 µs   ▇█ ▂
                    (301.50 µs … 435.50 µs) 330.50 µs   ██ █
                    ( 54.80 kb … 567.09 kb)  56.86 kb ▂▁████▆▆▃▃▂▁▂▁▁▁▁▁▁▁▁

Lattice                      236.69 µs/iter 235.75 µs  █
                    (229.88 µs … 417.38 µs) 317.00 µs  █
                    ( 63.73 kb … 818.23 kb) 182.26 kb ▁█▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        296.14 µs/iter 296.83 µs    █
                    (282.33 µs … 493.46 µs) 341.54 µs    █
                    (  2.68 kb … 599.09 kb)  56.50 kb ▁▁▂█▅▂▃▂▃▂▁▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 308.24 µs
                     Lattice ┤ 236.69 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 296.14 µs
                             └                                            ┘

summary
  Lattice
   1.25x faster than Alien
   1.3x faster than Preact

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       329.12 µs/iter 329.08 µs    █
                    (322.63 µs … 609.54 µs) 351.25 µs   ██
                    (  5.59 kb … 614.52 kb)   8.15 kb ▁▁████▃▃▂▁▂▂▁▁▁▁▁▁▁▁▁

Lattice                      190.90 µs/iter 190.96 µs  █
                    (186.50 µs … 368.96 µs) 242.46 µs  █
                    ( 18.09 kb … 645.46 kb)  20.47 kb ▇█▄▇▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        297.80 µs/iter 296.92 µs   █
                    (287.96 µs … 402.88 µs) 357.88 µs   █
                    (  5.52 kb … 485.87 kb)   8.04 kb ▁▁██▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 329.12 µs
                     Lattice ┤ 190.90 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 297.80 µs
                             └                                            ┘

summary
  Lattice
   1.56x faster than Alien
   1.72x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       259.32 µs/iter 260.29 µs    █▆
                    (249.29 µs … 363.54 µs) 289.54 µs    ██
                    (  5.59 kb … 424.37 kb)   7.20 kb ▁▁▂██▅▂█▃▂▂▁▁▁▁▁▁▁▁▁▁

Lattice                       93.80 µs/iter  92.50 µs  █
                     (91.04 µs … 289.71 µs) 127.25 µs  █
                    (  1.37 kb … 669.46 kb)  32.54 kb ▁█▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        276.54 µs/iter 278.04 µs █
                    (271.33 µs … 357.58 µs) 314.04 µs █
                    (  2.96 kb … 519.46 kb)   7.43 kb █▄█▇▆▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 259.32 µs
                     Lattice ┤ 93.80 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 276.54 µs
                             └                                            ┘

summary
  Lattice
   2.76x faster than Preact
   2.95x faster than Alien
  ✓ Completed in 10.81s

Running: write-heavy

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        55.47 µs/iter  54.92 µs    █
                      (52.79 µs … 97.79 µs)  65.42 µs    █
                    ( 32.00  b … 528.35 kb) 943.20  b ▁▁▁█▁▁▄▁▁▁▁▁▁▂▁▁▁▁▁▁▁

Lattice                      142.03 µs/iter 142.54 µs     █
                    (135.67 µs … 290.08 µs) 158.50 µs     █
                    ( 11.49 kb … 417.49 kb)  14.32 kb ▁▁▁▁█▂▃▂▃▁▁▁▁▃▁▁▁▁▁▁▁

Alien                         45.83 µs/iter  44.38 µs █
                     (43.75 µs … 109.92 µs)  84.50 µs █
                    ( 32.00  b …   1.89 mb) 739.12  b █▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 55.47 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 142.03 µs
                       Alien ┤ 45.83 µs
                             └                                            ┘

summary
  Alien
   1.21x faster than Preact
   3.1x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        32.06 µs/iter  31.17 µs █
                      (30.67 µs … 97.42 µs)  55.96 µs █
                    ( 32.00  b … 233.49 kb) 480.03  b █▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      133.43 µs/iter 133.08 µs      █
                    (127.17 µs … 179.50 µs) 146.75 µs      █
                    (  1.28 kb … 605.74 kb)   3.28 kb ▁▁▁▁▁█▃▁▃▂▁▁▁▁▁▃▁▁▁▁▁

Alien                         40.17 µs/iter  39.04 µs  █
                      (37.75 µs … 90.00 µs)  77.79 µs  █
                    ( 32.00  b … 282.90 kb) 476.41  b ▁█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 32.06 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 133.43 µs
                       Alien ┤■■■ 40.17 µs
                             └                                            ┘

summary
  Preact
   1.25x faster than Alien
   4.16x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        93.26 µs/iter  92.21 µs     █
                     (89.25 µs … 339.25 µs) 105.13 µs     █
                    (  5.50 kb … 830.96 kb)   6.77 kb ▁▁▂██▁▁▄▁▁▁▃▁▁▁▁▁▁▁▁▁

Lattice                      179.07 µs/iter 186.92 µs  ▄       █
                    (154.88 µs … 333.13 µs) 226.83 µs  █       █
                    ( 29.74 kb … 660.96 kb)  69.42 kb ▂█▃▂▂▁▁▁▁█▅▁▁▁▁▁▁▄▃▁▁

Alien                        141.32 µs/iter 140.33 µs  █
                    (137.46 µs … 309.83 µs) 162.42 µs  █
                    (  2.37 kb …   1.09 mb)   7.12 kb ▁█▇▂▄▂▁▃▁▁▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 93.26 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 179.07 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■ 141.32 µs
                             └                                            ┘

summary
  Preact
   1.52x faster than Alien
   1.92x faster than Lattice
  ✓ Completed in 10.83s

Summary:
  Total: 12
  Success: 12
  Failed: 0