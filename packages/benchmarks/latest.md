Found 12 benchmark suites

Running: batch-operations

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       546.21 µs/iter 545.42 µs    █
                    (518.17 µs … 705.71 µs) 652.25 µs    █
                    ( 10.85 kb …   1.35 mb) 937.45 kb ▂▁██▆▄▃▂▁▂▁▁▁▂▂▁▁▁▁▁▁

Lattice                      756.29 µs/iter 755.63 µs    █
                    (720.71 µs … 943.04 µs) 880.50 µs    █
                    (488.41 kb …   1.52 mb) 938.89 kb ▂▂▁█▄▃▃▂▂▂▁▂▁▁▂▁▁▁▁▁▁

Alien                        424.32 µs/iter 424.71 µs        █
                    (407.71 µs … 573.04 µs) 449.21 µs        █▃
                    (456.00  b … 377.99 kb) 976.69  b ▁▁▁▁▁▁▁██▃▂▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■ 546.21 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 756.29 µs
                       Alien ┤ 424.32 µs
                             └                                            ┘

summary
  Alien
   1.29x faster than Preact
   1.78x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       131.70 µs/iter 129.79 µs  █
                    (123.83 µs … 388.67 µs) 214.54 µs  █
                    ( 23.66 kb …   1.03 mb) 204.54 kb ▂█▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      269.23 µs/iter 269.08 µs   █
                    (256.13 µs … 511.33 µs) 349.08 µs   █
                    (  3.50 kb … 631.25 kb) 205.78 kb ▁▁█▅▅▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        217.16 µs/iter 216.58 µs  █
                    (211.58 µs … 363.50 µs) 287.67 µs  █
                    ( 44.88 kb … 532.88 kb) 150.00 kb ▁█▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 131.70 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 269.23 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■ 217.16 µs
                             └                                            ┘

summary
  Preact
   1.65x faster than Alien
   2.04x faster than Lattice

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       412.31 µs/iter 416.67 µs   █
                    (391.67 µs … 594.17 µs) 498.71 µs   █▃
                    (103.30 kb …   1.11 mb) 516.63 kb ▁▂██▂▆▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      660.28 µs/iter 664.08 µs    █
                    (634.33 µs … 857.92 µs) 762.33 µs   ▂█
                    ( 99.70 kb …   2.30 mb) 517.95 kb ▁▁██▃▅▅▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        433.92 µs/iter 432.46 µs  █▂
                    (424.75 µs … 596.08 µs) 491.00 µs  ██
                    ( 10.06 kb … 693.87 kb) 110.86 kb ▁██▅▂▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 412.31 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 660.28 µs
                       Alien ┤■■■ 433.92 µs
                             └                                            ┘

summary
  Preact
   1.05x faster than Alien
   1.6x faster than Lattice
  ✓ Completed in 10.80s

Running: computed-chains

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       401.19 µs/iter 400.38 µs      █
                    (382.42 µs … 487.21 µs) 446.42 µs     ▅█
                    (408.00  b … 288.45 kb) 822.13  b ▁▂▂▂██▇▂▃▃▂▂▂▂▁▁▂▁▁▁▁

Lattice                      543.05 µs/iter 543.71 µs       █
                    (524.92 µs … 702.54 µs) 576.46 µs       █▂
                    (504.00  b … 430.73 kb)   1.09 kb ▂▁▁▁▁▁██▄▂▂▁▁▂▁▁▁▁▁▁▁

Alien                        385.68 µs/iter 382.58 µs      █
                    (352.79 µs … 487.67 µs) 457.25 µs      █
                    (408.00  b … 287.49 kb)   0.98 kb ▁▁▁▁▄█▂▄▂▂▂▁▁▁▁▁▁▁▁▂▂

                             ┌                                            ┐
                      Preact ┤■■■ 401.19 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 543.05 µs
                       Alien ┤ 385.68 µs
                             └                                            ┘

summary
  Alien
   1.04x faster than Preact
   1.41x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       217.29 µs/iter 220.00 µs  █
                    (211.83 µs … 268.00 µs) 230.54 µs  █     ▆
                    (120.00  b … 541.90 kb)   1.38 kb ▁█▂▁▆▁▁█▂▆▄▁▂▁▃▂▃▁▁▁▁

Lattice                      324.10 µs/iter 326.88 µs    █
                    (309.54 µs … 455.58 µs) 359.75 µs    █▂▂ ▄
                    (120.00  b … 638.99 kb)   2.13 kb ▁▁▁███▄█▃▂▂▂▂▂▂▂▁▂▁▁▁

Alien                        219.07 µs/iter 219.67 µs    █
                    (213.88 µs … 255.79 µs) 235.33 µs   ▆█
                    ( 48.00  b … 384.40 kb)   1.62 kb ▁▁██▄▄▅▂▁▂▂▆▁▂▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 217.29 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 324.10 µs
                       Alien ┤■ 219.07 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.49x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       110.39 µs/iter 110.04 µs     █
                    (105.75 µs … 268.58 µs) 128.21 µs    ▃█
                    (104.00  b … 873.49 kb)   1.06 kb ▁▁▁██▂▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      149.75 µs/iter 150.38 µs   █▃
                    (145.88 µs … 302.25 µs) 166.67 µs   ██
                    ( 32.00  b … 413.90 kb)   1.36 kb ▁▂██▅▅▂▅▂▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        104.21 µs/iter 103.79 µs   █
                    (102.25 µs … 137.38 µs) 117.54 µs   █
                    ( 48.00  b … 259.40 kb) 781.48  b ▁▇█▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■ 110.39 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 149.75 µs
                       Alien ┤ 104.21 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Preact
   1.44x faster than Lattice
  ✓ Completed in 10.81s

Running: conditional-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       601.30 µs/iter 596.38 µs  █
                    (585.00 µs … 729.08 µs) 682.92 µs  █▇
                    ( 12.90 kb …   1.18 mb) 859.11 kb ▁██▃▂▂▂▂▁▁▂▁▁▁▁▁▁▂▁▁▁

Lattice                      598.21 µs/iter 595.83 µs    █
                    (578.83 µs … 700.71 µs) 677.21 µs   ▄█
                    (504.00  b … 740.99 kb)   1.21 kb ▁███▅▂▂▂▂▁▁▁▁▂▂▂▂▁▁▁▁

Alien                          1.01 ms/iter 568.75 µs █
                     (536.83 µs … 12.75 ms)  11.65 ms █
                    ( 13.88 kb …   1.06 mb) 701.55 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 601.30 µs
                     Lattice ┤ 598.21 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.01 ms
                             └                                            ┘

summary
  Lattice
   1.01x faster than Preact
   1.68x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       930.38 µs/iter 934.33 µs    █
                      (880.17 µs … 1.22 ms)   1.08 ms    █
                    (370.59 kb …   1.32 mb) 860.22 kb ▂▁▃██▇▅▃▂▂▁▁▂▂▂▁▂▂▁▁▁

Lattice                        1.38 ms/iter   1.37 ms  ▂█
                        (1.36 ms … 1.50 ms)   1.43 ms  ██▃
                    (504.00  b … 519.02 kb)   2.75 kb ▃███▅▃▁▁▁▁▁▁▁▁▃▄▂▁▁▁▁

Alien                          1.28 ms/iter 863.29 µs █
                     (826.33 µs … 12.06 ms)  11.50 ms █
                    (297.75 kb …   1.09 mb) 702.65 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 930.38 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.38 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.28 ms
                             └                                            ┘

summary
  Preact
   1.37x faster than Alien
   1.48x faster than Lattice
  ✓ Completed in 8.68s

Running: dense-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   163.61 µs/iter 164.38 µs   █▄
                    (156.33 µs … 248.38 µs) 194.00 µs ▅▆██▄▄▃▂▂▂▂▂▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   4.90 ms)  11.14 kb (440.00  b…  1.01 mb)

Preact - 75% dense updates   231.15 µs/iter 232.75 µs  ▂█▃
                    (222.08 µs … 356.88 µs) 267.38 µs ▃███▅▅▄▂▂▂▂▂▂▁▂▁▁▁▁▁▁
                  gc(  1.41 ms …   3.50 ms)  12.60 kb (456.00  b…977.98 kb)

Preact - 90% dense updates   268.05 µs/iter 274.75 µs  █
                    (260.17 µs … 307.92 µs) 296.63 µs ▇█▂▁▁▁▂▃▄▃▂▃▂▂▂▁▁▁▁▁▁
                  gc(  1.39 ms …   2.23 ms)   9.01 kb (456.00  b…136.95 kb)

Preact - 100% dense updates  303.01 µs/iter 306.42 µs         ▇█▅
                    (289.75 µs … 343.33 µs) 320.92 µs ▆▇▅▄▃▂▂▅█████▄▃▃▂▁▂▁▂
                  gc(  1.37 ms …   2.28 ms)   4.94 kb (456.00  b… 72.45 kb)

Lattice - 50% dense updates  194.14 µs/iter 192.88 µs █▆
                    (190.42 µs … 286.83 µs) 234.58 µs ██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   5.07 ms)  36.39 kb (504.00  b…  1.67 mb)

Lattice - 75% dense updates  305.07 µs/iter 307.58 µs      ██
                    (288.96 µs … 383.54 µs) 338.42 µs ▅▄▁▂▄███▆▅▂▂▁▂▁▁▁▁▁▁▁
                  gc(  1.35 ms …   2.94 ms)  15.42 kb (504.00  b…227.45 kb)

Lattice - 90% dense updates  359.77 µs/iter 362.67 µs        ▅█
                    (343.25 µs … 397.33 µs) 384.63 µs ▁▄▄▂▂▅▅███▅▆▄▂▂▁▂▂▁▁▁
                  gc(  1.42 ms …   2.76 ms) 743.18  b (504.00  b… 32.49 kb)

Lattice - 100% dense updates 404.89 µs/iter 407.67 µs        ██
                    (386.63 µs … 436.88 µs) 430.08 µs ▂▃▂▁▂▂▆███▇▅▃▂▂▂▂▁▁▁▁
                  gc(  1.37 ms …   2.82 ms)   2.66 kb (456.00  b…152.99 kb)

Alien - 50% dense updates    149.28 µs/iter 149.79 µs    ▄█▅
                    (144.25 µs … 222.92 µs) 167.92 µs ██▆███▄▂▁▁▁▁▂▁▁▁▁▁▁▁▁
                  gc(  1.51 ms …   4.90 ms)  38.43 kb (504.00  b…  1.71 mb)

Alien - 75% dense updates    225.45 µs/iter 230.71 µs ▂█       ▅▂
                    (214.54 µs … 261.00 µs) 246.17 µs ██▃▃▁▁▁▁▂██▅▄▃▃▂▂▁▁▂▁
                  gc(  1.45 ms …   2.74 ms)  16.97 kb (504.00  b…287.77 kb)

Alien - 90% dense updates    268.87 µs/iter 274.42 µs  █      ▅
                    (257.33 µs … 302.17 µs) 295.38 µs ██▁▁▂▁▁▆█▆▄▄▄▂▂▁▁▁▁▁▁
                  gc(  1.45 ms …   3.03 ms)   4.51 kb (504.00  b…104.99 kb)

Alien - 100% dense updates   307.37 µs/iter 309.96 µs        █
                    (290.04 µs … 351.42 µs) 336.33 µs ▂▃▂▂▃▂▆█▇▅▄▂▂▂▂▂▂▁▁▁▁
                  gc(  1.42 ms …   2.24 ms)   2.66 kb (504.00  b… 40.49 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■ 163.61 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■ 231.15 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■ 268.05 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■ 303.01 µs
 Lattice - 50% dense updates ┤■■■■■■ 194.14 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 305.07 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 359.77 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 404.89 µs
   Alien - 50% dense updates ┤ 149.28 µs
   Alien - 75% dense updates ┤■■■■■■■■■■ 225.45 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■ 268.87 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 307.37 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   -1.01…+1.1x faster than Preact - $changeRatio% dense updates
   +1.32…+1.3x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.40s

Running: diamond-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       647.17 µs/iter 646.17 µs       █
                    (624.00 µs … 734.13 µs) 692.96 µs       █
                    (456.00  b … 241.71 kb) 787.68  b ▁▁▁▁▂▆█▄▂▁▂▂▂▂▁▁▁▁▁▁▁

Lattice                        1.20 ms/iter   1.21 ms   █
                        (1.16 ms … 1.31 ms)   1.30 ms   █▂
                    (488.00  b … 626.99 kb)   1.56 kb ▁▁██▄▃▃▄▄▃▂▂▃▃▂▁▁▁▁▁▁

Alien                        578.22 µs/iter 577.42 µs    █▅
                    (555.38 µs … 699.00 µs) 648.46 µs    ██
                    (504.00  b … 379.23 kb)   1.06 kb ▁▁▂██▄▂█▃▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■ 647.17 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.20 ms
                       Alien ┤ 578.22 µs
                             └                                            ┘

summary
  Alien
   1.12x faster than Preact
   2.07x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       311.49 µs/iter 311.96 µs     █
                    (297.38 µs … 501.29 µs) 345.54 µs     █
                    ( 16.74 kb … 567.09 kb)  56.60 kb ▁▁▁▁██▇▃▂▂▂▂▂▂▁▁▁▁▁▁▁

Lattice                      363.37 µs/iter 362.96 µs  █▄
                    (352.71 µs … 580.21 µs) 413.71 µs  ██▄
                    ( 53.68 kb …   1.09 mb)  57.34 kb ▁███▅▄▂▂▂▂▂▂▂▁▁▁▁▁▁▁▁

Alien                        293.53 µs/iter 292.67 µs  ▇█
                    (285.58 µs … 462.17 µs) 332.13 µs  ██
                    ( 16.48 kb … 599.13 kb)  56.58 kb ▂██▇▂▂▂▂▇▃▂▁▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■ 311.49 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 363.37 µs
                       Alien ┤ 293.53 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Preact
   1.24x faster than Lattice

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       734.58 µs/iter 733.58 µs     █
                    (712.58 µs … 813.96 µs) 792.79 µs     █
                    (504.00  b … 831.06 kb)   1.53 kb ▁▁▁▄█▄▃▂▂▂▂▁▂▁▁▁▁▁▁▁▁

Lattice                        1.23 ms/iter   1.23 ms  █▄
                        (1.22 ms … 1.39 ms)   1.30 ms  ██
                    (456.00  b …   2.60 mb)   5.48 kb ▄██▇▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        616.12 µs/iter 613.04 µs   █
                    (597.29 µs … 790.79 µs) 718.79 µs  ▇█
                    (391.13 kb …   1.51 mb) 393.98 kb ▁██▅▃▃▂▂▂▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 734.58 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.23 ms
                       Alien ┤ 616.12 µs
                             └                                            ┘

summary
  Alien
   1.19x faster than Preact
   1.99x faster than Lattice
  ✓ Completed in 10.85s

Running: effect-triggers

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       319.29 µs/iter 322.46 µs       █
                    (281.21 µs … 592.71 µs) 400.50 µs       █
                    (648.00  b …   2.37 mb) 157.74 kb ▁▁▁▁▁▁██▂▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      323.35 µs/iter 322.75 µs  █▂
                    (294.92 µs … 518.71 µs) 420.13 µs  ██
                    (504.00  b …   1.04 mb) 156.38 kb ▁██▆▃▂▂▁▁▁▁▁▂▇▄▂▁▁▁▁▁

Alien                        270.34 µs/iter 272.63 µs      █
                    (230.83 µs … 533.29 µs) 349.88 µs      █
                    (504.00  b …   2.11 mb) 157.53 kb ▁▁▁▁▁█▇▂▃▂▅▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 319.29 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 323.35 µs
                       Alien ┤ 270.34 µs
                             └                                            ┘

summary
  Alien
   1.18x faster than Preact
   1.2x faster than Lattice

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          211.39 µs/iter 211.17 µs    █
                    (204.63 µs … 321.88 µs) 231.25 µs    █ █
                    (120.00  b … 638.70 kb)   1.65 kb ▁▁▂███▃▄▂▂▃▁▁▁▁▁▁▁▁▁▁

Lattice - 10 effects         273.73 µs/iter 273.88 µs   █
                    (265.50 µs … 655.46 µs) 305.54 µs   █▅
                    (120.00  b … 480.40 kb)   2.19 kb ▁▁██▆▄▂▂▄▂▁▁▁▁▁▁▁▁▁▁▁

Alien - 10 effects           220.96 µs/iter 222.00 µs      ▃█
                    (212.96 µs … 279.29 µs) 236.75 µs      ██ ▅
                    (120.00  b …   1.11 mb)   1.66 kb ▁▁▁▁▁██▂█▂▃▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤ 211.39 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 273.73 µs
          Alien - 10 effects ┤■■■■■ 220.96 µs
                             └                                            ┘

summary
  Preact - 10 effects
   1.05x faster than Alien - 10 effects
   1.29x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         7.56 µs/iter   7.42 µs     █
                      (7.13 µs … 147.42 µs)   8.25 µs     █
                    (312.00  b … 511.77 kb)  20.62 kb ▁▁▃███▄▄▂▂▂▁▁▁▁▁▁▁▁▁▁

Lattice                       11.63 µs/iter   8.04 µs  █
                        (7.17 µs … 2.67 ms)  17.75 µs  █
                    (  1.02 kb … 360.89 kb)  23.78 kb ▃█▆▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          5.73 µs/iter   5.76 µs  ▄█
                        (5.67 µs … 5.84 µs)   5.84 µs  ██                 ▅
                    (437.50  b …   3.53 kb)   2.91 kb ▅███▁█▁▁▅▅▁▅▅▁▁▁▅▅▁▁█

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■ 7.56 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 11.63 µs
                       Alien ┤ 5.73 µs
                             └                                            ┘

summary
  Alien
   1.32x faster than Preact
   2.03x faster than Lattice
  ✓ Completed in 10.88s

Running: filtered-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        296.42 µs/iter 313.54 µs    █
                    (277.17 µs … 347.25 µs) 333.54 µs    █
                    (120.00  b … 480.40 kb)   1.57 kb ▁▁▂█▅▂▁▁▁▁▁▁▁▅▂▁▁▅▃▁▁

Lattice - 90% filtered       505.22 µs/iter 504.17 µs      █
                    (486.92 µs … 581.54 µs) 542.58 µs      █▂
                    (504.00  b … 441.49 kb)   1.57 kb ▁▁▁▁▁██▃▂▂▁▂▂▁▁▁▁▁▁▁▁

Alien - 90% filtered         294.43 µs/iter 285.13 µs █
                    (280.71 µs … 390.83 µs) 359.17 µs █
                    ( 48.00  b … 480.40 kb)   1.45 kb █▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂▁

                             ┌                                            ┐
       Preact - 90% filtered ┤ 296.42 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 505.22 µs
        Alien - 90% filtered ┤ 294.43 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1.01x faster than Preact - 90% filtered
   1.72x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       842.73 µs/iter 841.83 µs    █
                      (810.71 µs … 1.04 ms) 967.75 µs    █▇
                    (234.87 kb … 914.70 kb) 235.70 kb ▂▁▁██▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter        1.20 ms/iter   1.20 ms  ▄█
                        (1.19 ms … 1.38 ms)   1.31 ms  ██
                    (234.87 kb … 910.13 kb) 236.68 kb ▁██▅▃▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien - toggle filter        754.90 µs/iter 755.00 µs    █
                    (731.79 µs … 880.00 µs) 847.33 µs    ██
                    (196.15 kb …   1.05 mb) 236.05 kb ▁▁▃██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■ 842.73 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.20 ms
       Alien - toggle filter ┤ 754.90 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.12x faster than Preact - toggle filter
   1.59x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       405.61 µs/iter 405.04 µs    █
                    (387.58 µs … 505.75 µs) 466.25 µs    █
                    (408.00  b … 495.90 kb)   1.39 kb ▁▁▁██▂▃▅▁▁▁▁▁▁▁▁▁▁▁▂▁

Lattice                      787.52 µs/iter 793.96 µs       █
                    (756.67 µs … 873.92 µs) 836.92 µs       █▂
                    (456.00  b … 989.49 kb)   3.25 kb ▁▁▁▁▂▂██▃▇▆▂▃▂▁▁▁▁▁▁▁

Alien                        416.61 µs/iter 422.67 µs   █▆
                    (407.58 µs … 495.42 µs) 439.08 µs   ██
                    (504.00  b … 320.99 kb) 889.32  b ▂▁██▃▂▂▁▁▇▆█▂▁▁▁▁▂▃▁▁

                             ┌                                            ┐
                      Preact ┤ 405.61 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 787.52 µs
                       Alien ┤■ 416.61 µs
                             └                                            ┘

summary
  Preact
   1.03x faster than Alien
   1.94x faster than Lattice
  ✓ Completed in 10.84s

Running: scaling-subscribers

clk: ~3.08 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       17.21 µs/iter  16.25 µs  █
                      (14.88 µs … 47.88 µs)  41.00 µs ██▂▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   2.82 ms)   7.82 kb (456.00  b…453.73 kb)

Preact - 50 subscribers       28.09 µs/iter  28.13 µs █
                      (26.17 µs … 74.04 µs)  44.25 µs ██▆▂▁▁▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.86 ms)   9.78 kb (456.00  b…407.23 kb)

Preact - 100 subscribers      50.74 µs/iter  50.96 µs               ▃ █
                      (49.76 µs … 51.70 µs)  51.25 µs ▆▁▆▆▁▁▁▁▁▁▁▁▆▁█▁█▁▆▁▆
                  gc(  2.47 ms …   3.94 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     104.89 µs/iter 106.25 µs  █
                    (102.63 µs … 119.79 µs) 113.25 µs ▇█▄▂▂▂▂▂▂▂▂▂▂▂▂▂▂▁▁▁▁
                  gc(  1.50 ms …   2.40 ms)  22.41 kb (456.00  b…124.95 kb)

Preact - 400 subscribers     314.64 µs/iter 321.33 µs       █▆▂▆▅
                    (286.83 µs … 356.08 µs) 346.21 µs ▂▂▂▂▃▅███████▆▆▄▃▂▂▂▁
                  gc(  1.41 ms …   2.83 ms)   6.08 kb (456.00  b…116.45 kb)

Lattice - 25 subscribers      18.26 µs/iter  17.21 µs █
                      (16.67 µs … 63.58 µs)  37.00 µs █▂▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   3.29 ms)   5.09 kb (488.00  b…203.27 kb)

Lattice - 50 subscribers      36.68 µs/iter  35.63 µs ▄█
                     (35.00 µs … 144.08 µs)  47.75 µs ██▂▁▁▁▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.46 ms …   2.95 ms)   7.97 kb (504.00  b…412.65 kb)

Lattice - 100 subscribers     69.82 µs/iter  69.75 µs  █
                      (69.17 µs … 81.54 µs)  76.63 µs ▃█▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.50 ms …   2.91 ms)   6.57 kb (504.00  b…132.99 kb)

Lattice - 200 subscribers    153.33 µs/iter 156.13 µs   █       ▃ ▅▃
                    (145.17 µs … 172.88 µs) 161.71 µs ▂▄█▇▄▄▂▄▆█████▇▅▆▄▄▄▂
                  gc(  1.49 ms …   2.91 ms)  18.49 kb (504.00  b…136.49 kb)

Lattice - 400 subscribers    348.11 µs/iter 355.17 µs      █
                    (327.75 µs … 383.25 µs) 377.50 µs ▂▂▄▄▄██▅▇▃▇▇▄▅▃▃▃▂▂▂▁
                  gc(  1.45 ms …   2.88 ms)   2.82 kb (456.00  b… 72.45 kb)

Alien - 25 subscribers        14.75 µs/iter  14.25 µs  █
                      (13.00 µs … 42.13 µs)  29.71 µs ▆█▃▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   2.81 ms)   5.66 kb (504.00  b…109.32 kb)

Alien - 50 subscribers        24.99 µs/iter  25.02 µs █  ███  █ █    █   ██
                      (24.90 µs … 25.10 µs)  25.05 µs █▁▁███▁▁█▁█▁▁▁▁█▁▁▁██
                  gc(  2.01 ms …   3.46 ms)  19.67  b (  0.10  b…263.52  b)

Alien - 100 subscribers       49.91 µs/iter  50.10 µs    █           █
                      (49.45 µs … 50.80 µs)  50.32 µs █▁██▁▁▁██▁▁█▁▁██▁▁▁▁█
                  gc(  2.63 ms …   3.20 ms)   0.11  b (  0.10  b…  0.12  b)

Alien - 200 subscribers      115.33 µs/iter 114.58 µs  ▄▄██
                    (105.92 µs … 375.46 µs) 150.54 µs ▄████▂▂▂▄▃▃▂▁▁▁▁▁▁▁▁▁
                  gc(  1.46 ms …   4.57 ms)  15.61 kb (504.00  b…136.49 kb)

Alien - 400 subscribers      298.87 µs/iter 305.54 µs      ▄▇▄ ▂█▆▂
                    (272.96 µs … 348.21 µs) 329.33 µs ▂▂▃▅▆█████████▇▄▄▃▂▂▂
                  gc(  1.47 ms …   3.02 ms)   4.05 kb (504.00  b… 72.49 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 17.21 µs
     Preact - 50 subscribers ┤■ 28.09 µs
    Preact - 100 subscribers ┤■■■■ 50.74 µs
    Preact - 200 subscribers ┤■■■■■■■■■ 104.89 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 314.64 µs
    Lattice - 25 subscribers ┤ 18.26 µs
    Lattice - 50 subscribers ┤■■ 36.68 µs
   Lattice - 100 subscribers ┤■■■■■■ 69.82 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■■■ 153.33 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 348.11 µs
      Alien - 25 subscribers ┤ 14.75 µs
      Alien - 50 subscribers ┤■ 24.99 µs
     Alien - 100 subscribers ┤■■■■ 49.91 µs
     Alien - 200 subscribers ┤■■■■■■■■■■ 115.33 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 298.87 µs
                             └                                            ┘

summary
  Alien - $sources subscribers
   +1.05…+1.17x faster than Preact - $sources subscribers
   +1.16…+1.24x faster than Lattice - $sources subscribers
  ✓ Completed in 32.87s

Running: signal-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          353.66 µs/iter 323.67 µs █
                    (314.38 µs … 608.54 µs) 565.29 µs █
                    (408.00  b … 358.23 kb)   1.09 kb █▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃▃

Lattice - write only         251.51 µs/iter 405.00 µs █
                     (94.67 µs … 499.75 µs) 480.08 µs █               ▅
                    (120.00  b … 621.40 kb)   1.42 kb █▂▁▁▁▁▁▁▁▁█▁▁▁▁▁█▂▁▇▁

Alien - write only            71.07 µs/iter  46.92 µs █
                     (45.38 µs … 611.08 µs) 564.58 µs █
                    ( 48.00  b … 813.40 kb) 505.50  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           234.46 µs/iter 404.79 µs █
                     (94.67 µs … 466.25 µs) 430.67 µs █                 ▂
                    ( 48.00  b … 342.16 kb)   1.24 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██▂

Lattice - read only          215.00 µs/iter 403.92 µs █
                     (38.54 µs … 447.08 µs) 426.33 µs █                  █
                    ( 48.00  b … 573.90 kb)   1.15 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆█▂

Alien - read only             92.72 µs/iter  60.08 µs █
                     (59.29 µs … 624.17 µs) 586.08 µs █
                    ( 32.00  b … 717.40 kb) 470.92  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    381.25 µs/iter 340.00 µs █
                    (325.33 µs … 883.71 µs) 851.21 µs █
                    (408.00  b … 301.61 kb)   0.98 kb █▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▃

Lattice - read/write mixed   309.28 µs/iter 754.54 µs █
                     (95.75 µs … 842.75 µs) 791.92 µs █
                    ( 32.00  b … 632.90 kb)   1.42 kb █▁▁▁▁▁▅▄▁▁▁▁▁▁▁▁▁▁▁▇▅

Alien - read/write mixed     350.03 µs/iter 207.63 µs █
                      (127.67 µs … 1.48 ms)   1.45 ms █
                    (408.00  b … 160.49 kb) 680.79  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▅

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 353.66 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■■■ 251.51 µs
          Alien - write only ┤ 71.07 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■ 234.46 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 215.00 µs
           Alien - read only ┤■■ 92.72 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 381.25 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.28 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 350.03 µs
                             └                                            ┘

summary
  Alien - write only
   1.3x faster than Alien - read only
   3.03x faster than Lattice - read only
   3.3x faster than Preact - read only
   3.54x faster than Lattice - write only
   4.35x faster than Lattice - read/write mixed
   4.93x faster than Alien - read/write mixed
   4.98x faster than Preact - write only
   5.36x faster than Preact - read/write mixed
  ✓ Completed in 10.80s

Running: sparse-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   37.92 µs/iter  36.46 µs  █
                     (34.88 µs … 109.50 µs)  72.88 µs ██▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   3.06 ms)  13.60 kb (456.00  b…658.45 kb)

Preact - 15% sparse updates   45.01 µs/iter  43.88 µs █
                      (43.08 µs … 80.96 µs)  68.33 µs █▆▁▁▂▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   2.88 ms)   6.96 kb (456.00  b…388.01 kb)

Preact - 20% sparse updates   56.06 µs/iter  56.37 µs                 █
                      (54.96 µs … 57.04 µs)  56.59 µs █▁█▁█▁▁▁▁▁▁▁██▁███▁██
                  gc(  2.52 ms …   4.18 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   72.39 µs/iter  73.21 µs  █
                      (71.04 µs … 87.92 µs)  80.46 µs ██▃▂▂▃▃▂▄▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   2.69 ms)   6.74 kb (456.00  b…132.95 kb)

Lattice - 10% sparse updates  40.83 µs/iter  39.50 µs █
                     (38.92 µs … 103.00 µs)  83.33 µs █▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   3.05 ms)  13.43 kb (504.00  b…  1.43 mb)

Lattice - 15% sparse updates  58.86 µs/iter  58.63 µs  █
                      (58.00 µs … 66.75 µs)  64.71 µs ▃██▂▁▁▁▁▁▁▁▁▁▁▁▁▂▁▁▁▁
                  gc(  1.47 ms …   2.82 ms)  13.41 kb (504.00  b…210.88 kb)

Lattice - 20% sparse updates  77.86 µs/iter  77.67 µs  █
                      (76.96 µs … 93.75 µs)  89.83 µs ▇█▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   2.89 ms)  13.46 kb (504.00  b…132.99 kb)

Lattice - 25% sparse updates  99.01 µs/iter 100.08 µs  █    ▇
                     (96.46 µs … 118.71 µs) 108.50 µs ▅█▆▃▁██▆▂▂▂▂▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.90 ms)  22.91 kb (504.00  b…124.99 kb)

Alien - 10% sparse updates    30.36 µs/iter  29.54 µs █
                      (29.04 µs … 70.08 µs)  57.54 µs █▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.40 ms …   2.97 ms)   8.30 kb (456.00  b…192.66 kb)

Alien - 15% sparse updates    43.74 µs/iter  43.71 µs  ▅█
                      (43.29 µs … 56.25 µs)  46.38 µs ▃██▇▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   2.89 ms)   6.75 kb (456.00  b…124.95 kb)

Alien - 20% sparse updates    55.52 µs/iter  55.61 µs         █
                      (55.04 µs … 56.37 µs)  55.99 µs ██▁▁▁████▁█▁█▁▁▁▁█▁▁█
                  gc(  2.43 ms …   3.04 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    75.09 µs/iter  75.67 µs         ▅▅█
                      (72.08 µs … 91.63 µs)  79.08 µs ▃▄▅▄▃▄▆▇████▅▃▂▂▁▂▂▁▁
                  gc(  1.37 ms …   2.79 ms)  11.44 kb (456.00  b…132.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■■■ 37.92 µs
 Preact - 15% sparse updates ┤■■■■■■■ 45.01 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■ 56.06 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■ 72.39 µs
Lattice - 10% sparse updates ┤■■■■■ 40.83 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■■ 58.86 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■ 77.86 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 99.01 µs
  Alien - 10% sparse updates ┤ 30.36 µs
  Alien - 15% sparse updates ┤■■■■■■■ 43.74 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■ 55.52 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■ 75.09 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   -1.04…+1.25x faster than Preact - $changeRatio% sparse updates
   +1.32…+1.34x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.29s

Running: wide-fanout

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       306.58 µs/iter 307.38 µs   █
                    (299.79 µs … 451.08 µs) 332.25 µs   █
                    ( 54.80 kb … 567.09 kb)  56.75 kb ▁▁█▃██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      351.36 µs/iter 351.50 µs   █
                    (343.04 µs … 519.79 µs) 391.58 µs   █
                    ( 16.46 kb …   0.99 mb)  57.26 kb ▁▁██▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        297.58 µs/iter 301.46 µs  █▂
                    (288.17 µs … 447.17 µs) 333.67 µs  ██
                    ( 15.13 kb … 596.18 kb)  56.78 kb ▆███▅▆▄▃█▃▂▂▂▂▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■ 306.58 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 351.36 µs
                       Alien ┤ 297.58 µs
                             └                                            ┘

summary
  Alien
   1.03x faster than Preact
   1.18x faster than Lattice

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       362.12 µs/iter 362.33 µs    █
                    (355.38 µs … 581.71 µs) 385.42 µs    █
                    (  5.87 kb …   1.75 mb)   8.05 kb ▂▁▁█▆█▃▂▁▁▁▂▁▁▁▁▁▁▁▁▁

Lattice                      265.37 µs/iter 265.63 µs  █
                    (258.79 µs … 388.04 µs) 312.96 µs  █
                    (  5.59 kb … 688.96 kb)   8.93 kb ▂██▄▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        298.78 µs/iter 298.46 µs  █
                    (292.25 µs … 396.67 µs) 351.33 µs  █▄
                    (  5.50 kb … 549.87 kb)   8.17 kb ▁██▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 362.12 µs
                     Lattice ┤ 265.37 µs
                       Alien ┤■■■■■■■■■■■■ 298.78 µs
                             └                                            ┘

summary
  Lattice
   1.13x faster than Alien
   1.36x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       257.97 µs/iter 257.96 µs   █
                    (252.04 µs … 326.38 µs) 291.54 µs  ▂█
                    (  5.59 kb … 538.75 kb)   7.19 kb ▁███▄▂▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      149.92 µs/iter 149.13 µs  █
                    (146.42 µs … 406.38 µs) 186.17 µs  █
                    (  3.40 kb … 941.24 kb)   8.56 kb ▁█▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        257.54 µs/iter 259.88 µs   █
                    (249.21 µs … 325.63 µs) 294.13 µs  ██
                    (  2.95 kb … 453.87 kb)   7.37 kb ▁███▃▂▃▇▃▂▂▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 257.97 µs
                     Lattice ┤ 149.92 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 257.54 µs
                             └                                            ┘

summary
  Lattice
   1.72x faster than Alien
   1.72x faster than Preact
  ✓ Completed in 10.80s

Running: write-heavy

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        55.86 µs/iter  55.42 µs   █
                     (54.13 µs … 103.58 µs)  65.46 µs   █
                    ( 32.00  b … 487.56 kb) 892.21  b ▁▅█▃▂▁▁▂▁▁▁▁▁▂▁▁▁▁▁▁▁

Lattice                      142.36 µs/iter 140.71 µs  █
                    (138.54 µs … 197.54 µs) 163.04 µs  █
                    ( 48.00  b … 459.49 kb)   1.71 kb ▁█▆▁▄▂▁▁▁▁▂▃▁▁▁▁▁▁▁▁▁

Alien                         45.93 µs/iter  45.71 µs  █
                     (42.96 µs … 114.33 µs)  83.88 µs  █
                    ( 32.00  b … 939.37 kb) 679.79  b ▂█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■ 55.86 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 142.36 µs
                       Alien ┤ 45.93 µs
                             └                                            ┘

summary
  Alien
   1.22x faster than Preact
   3.1x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        32.03 µs/iter  31.13 µs █
                      (30.63 µs … 76.42 µs)  55.50 µs █
                    ( 32.00  b … 256.49 kb) 533.64  b █▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Lattice                      137.47 µs/iter 136.42 µs  █
                    (130.33 µs … 935.13 µs) 176.88 µs  ██▆
                    ( 48.00  b … 612.49 kb)   2.30 kb ████▄▃▄▂▃▁▁▁▁▁▁▁▁▁▁▁▁

Alien                         41.05 µs/iter  40.17 µs █
                     (38.42 µs … 642.38 µs)  80.29 µs █▄
                    ( 32.00  b … 558.99 kb) 550.29  b ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

                             ┌                                            ┐
                      Preact ┤ 32.03 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 137.47 µs
                       Alien ┤■■■ 41.05 µs
                             └                                            ┘

summary
  Preact
   1.28x faster than Alien
   4.29x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        94.83 µs/iter  94.13 µs   █
                     (92.63 µs … 244.17 µs) 104.58 µs   █
                    (  1.46 kb … 655.96 kb)   6.85 kb ▁▂█▄▁▁▂▃▂▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      204.43 µs/iter 203.71 µs  █
                    (194.46 µs … 446.50 µs) 241.33 µs  █  ▆
                    (  5.52 kb … 892.46 kb)   8.03 kb ▂█▄▃█▂▂▁▁▁▁▁▁▁▁▁▄▂▁▁▂

Alien                        137.32 µs/iter 136.08 µs  █
                    (133.50 µs … 309.88 µs) 158.04 µs  █▇
                    (  1.96 kb … 549.46 kb)   6.96 kb ▁██▂▄▂▁▃▁▁▁▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 94.83 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 204.43 µs
                       Alien ┤■■■■■■■■■■■■■ 137.32 µs
                             └                                            ┘

summary
  Preact
   1.45x faster than Alien
   2.16x faster than Lattice
  ✓ Completed in 10.85s

Summary:
  Total: 12
  Success: 12
  Failed: 0