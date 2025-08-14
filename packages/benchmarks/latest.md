Found 12 benchmark suites

Running: batch-operations

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       546.30 µs/iter 543.33 µs  █
                    (531.17 µs … 680.50 µs) 637.33 µs  █▃
                    (461.35 kb …   1.32 mb) 938.23 kb ▁██▃▃▂▂▂▁▁▁▁▁▁▁▂▂▁▁▁▁

Lattice                      675.17 µs/iter 672.42 µs █▂
                    (664.79 µs … 812.00 µs) 762.46 µs ██
                    ( 27.10 kb …   1.31 mb) 937.30 kb ██▅▄▂▂▂▁▂▁▁▁▁▁▂▂▂▁▁▁▁

Alien                        423.95 µs/iter 424.63 µs        █
                    (406.79 µs … 578.58 µs) 447.63 µs        █ ▂
                    (456.00  b … 377.99 kb)   1.07 kb ▁▁▁▁▁▂▂█▃█▃▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■ 546.30 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 675.17 µs
                       Alien ┤ 423.95 µs
                             └                                            ┘

summary
  Alien
   1.29x faster than Preact
   1.59x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       130.87 µs/iter 129.04 µs  █
                    (124.96 µs … 364.88 µs) 207.54 µs  █
                    (  4.66 kb … 611.38 kb) 204.33 kb ▁█▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      236.69 µs/iter 234.25 µs  █
                    (225.92 µs … 567.83 µs) 331.46 µs  █
                    (  8.59 kb … 943.16 kb) 205.26 kb ▁█▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        221.11 µs/iter 223.83 µs  █
                    (214.54 µs … 402.42 µs) 296.88 µs  █▂
                    (  2.66 kb … 811.47 kb) 150.03 kb ▄██▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 130.87 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 236.69 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 221.11 µs
                             └                                            ┘

summary
  Preact
   1.69x faster than Alien
   1.81x faster than Lattice

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       427.78 µs/iter 425.54 µs  █
                    (417.79 µs … 599.83 µs) 516.29 µs  █
                    (170.28 kb …   1.20 mb) 516.81 kb ▁█▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      715.22 µs/iter 719.58 µs  █▂
                    (697.13 µs … 918.88 µs) 818.67 µs  ██  ▂
                    (186.38 kb …   2.00 mb) 518.33 kb ▁██▄▂█▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        480.21 µs/iter 479.33 µs    █
                    (462.33 µs … 660.92 µs) 551.13 µs    █▄
                    ( 38.56 kb … 693.91 kb) 111.02 kb ▁▁▁██▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 427.78 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 715.22 µs
                       Alien ┤■■■■■■ 480.21 µs
                             └                                            ┘

summary
  Preact
   1.12x faster than Alien
   1.67x faster than Lattice
  ✓ Completed in 10.79s

Running: computed-chains

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       403.52 µs/iter 405.25 µs      █
                    (387.67 µs … 447.29 µs) 435.04 µs      █
                    (408.00  b … 288.45 kb) 843.29  b ▁▁▁▃▂██▃▂▄▆▂▁▁▁▁▁▁▁▁▂

Lattice                      546.67 µs/iter 547.17 µs     █
                    (538.13 µs … 604.17 µs) 570.42 µs     █
                    (504.00  b … 335.10 kb) 986.36  b ▁▁▁▁█▄█▄▂▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        364.84 µs/iter 358.63 µs   █
                    (342.33 µs … 465.83 µs) 432.79 µs   █
                    (408.00  b … 287.49 kb) 996.39  b ▂▁██▃▂▂▁▂▁▁▁▁▁▁▁▁▁▂▄▂

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 403.52 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 546.67 µs
                       Alien ┤ 364.84 µs
                             └                                            ┘

summary
  Alien
   1.11x faster than Preact
   1.5x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       193.59 µs/iter 195.21 µs      █    ▇
                    (184.17 µs … 231.83 µs) 205.88 µs      █    █
                    (104.00  b … 354.90 kb)   1.39 kb ▁▁▁▁▁█▂▁▅▁█▅▄▄▂▁▂▁▁▁▁

Lattice                      325.74 µs/iter 325.54 µs  █
                    (321.13 µs … 470.71 µs) 352.54 µs  █
                    (120.00  b … 768.99 kb)   2.03 kb ▅█▆█▃▂▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        220.68 µs/iter 221.58 µs      █
                    (211.96 µs … 273.04 µs) 238.88 µs      █
                    ( 48.00  b … 387.40 kb)   1.72 kb ▁▁▁▁██▅▆▃▂▆▁▂▁▁▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 193.59 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 325.74 µs
                       Alien ┤■■■■■■■ 220.68 µs
                             └                                            ┘

summary
  Preact
   1.14x faster than Alien
   1.68x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       110.54 µs/iter 110.04 µs     █
                    (105.83 µs … 301.54 µs) 124.08 µs    ▆█▆
                    (120.00  b … 768.49 kb)   1.09 kb ▂▂▂███▂▃▅▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      147.37 µs/iter 148.04 µs  █
                    (143.58 µs … 417.88 µs) 166.17 µs  █▅
                    ( 48.00  b … 348.99 kb)   1.34 kb ▁██▅▄▆▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        104.63 µs/iter 104.25 µs      █
                    (100.75 µs … 188.33 µs) 113.33 µs      █
                    ( 48.00  b … 259.40 kb) 805.73  b ▁▁▁▁▁█▄▂▁▁▃▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■ 110.54 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 147.37 µs
                       Alien ┤ 104.63 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Preact
   1.41x faster than Lattice
  ✓ Completed in 10.84s

Running: conditional-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       586.32 µs/iter 581.96 µs  █
                    (571.08 µs … 742.25 µs) 676.92 µs  ██
                    (383.47 kb …   1.28 mb) 860.35 kb ▁██▄▂▂▁▁▁▁▁▁▁▁▁▁▂▂▁▁▁

Lattice                      554.29 µs/iter 550.71 µs   █
                    (537.96 µs … 652.79 µs) 630.58 µs  ▄█
                    (504.00  b … 715.49 kb)   1.59 kb ▁███▃▂▁▁▁▁▁▁▁▁▁▁▁▁▃▂▁

Alien                          1.01 ms/iter 574.17 µs █
                     (544.58 µs … 13.01 ms)  11.75 ms █
                    ( 30.38 kb … 846.23 kb) 700.86 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■ 586.32 µs
                     Lattice ┤ 554.29 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.01 ms
                             └                                            ┘

summary
  Lattice
   1.06x faster than Preact
   1.83x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       924.14 µs/iter 920.33 µs     █
                      (885.13 µs … 1.14 ms)   1.02 ms     █▆
                    (347.59 kb …   2.97 mb) 863.04 kb ▁▁▁▂██▃▂▂▂▁▁▁▁▁▁▂▁▁▁▁

Lattice                        1.32 ms/iter   1.31 ms         █
                        (1.27 ms … 1.45 ms)   1.37 ms        ▆█▃
                    (504.00  b … 517.99 kb)   2.69 kb ▁▁▁▁▁▁▁███▂▁▁▁▁█▂▁▁▁▁

Alien                          1.27 ms/iter 855.71 µs █
                     (841.33 µs … 12.07 ms)  11.47 ms █
                    ( 38.16 kb …   1.09 mb) 700.78 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 924.14 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.32 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.27 ms
                             └                                            ┘

summary
  Preact
   1.37x faster than Alien
   1.42x faster than Lattice
  ✓ Completed in 8.68s

Running: dense-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   161.93 µs/iter 162.42 µs   ▂█
                    (155.67 µs … 299.83 µs) 184.46 µs ▆▆██▅▆▃▂▂▂▂▂▁▂▁▁▂▁▁▁▁
                  gc(  1.42 ms …   4.79 ms)  10.56 kb (456.00  b…  1.03 mb)

Preact - 75% dense updates   226.89 µs/iter 226.83 µs  ▅█▂
                    (222.08 µs … 342.54 µs) 254.88 µs ▆███▃▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.35 ms …   2.77 ms)  10.81 kb (456.00  b…894.49 kb)

Preact - 90% dense updates   275.29 µs/iter 280.71 µs  █        ▆
                    (266.33 µs … 306.92 µs) 293.75 µs ██▂▁▁▁▁▁▁▄██▃▂▂▂▂▂▂▁▁
                  gc(  1.40 ms …   2.59 ms)   5.53 kb (456.00  b…104.95 kb)

Preact - 100% dense updates  317.53 µs/iter 320.25 µs         ██
                    (300.75 µs … 348.71 µs) 337.79 µs ▂▃▃▂▂▂▃▆███▆▆▂▂▂▁▂▂▂▁
                  gc(  1.38 ms …   2.37 ms)   3.55 kb (456.00  b… 51.95 kb)

Lattice - 50% dense updates  201.30 µs/iter 203.50 µs  █
                    (194.04 µs … 434.50 µs) 221.00 µs ▇██▅▇▄▇█▅▃▃▃▂▂▁▁▂▂▁▁▁
                  gc(  1.44 ms …   3.84 ms)  20.19 kb (504.00  b…  0.99 mb)

Lattice - 75% dense updates  304.79 µs/iter 306.83 µs        █
                    (288.63 µs … 411.79 µs) 332.79 µs ▂▄▃▁▁▁██▇▄▃▂▁▂▁▁▁▁▁▁▁
                  gc(  1.36 ms …   2.92 ms)  39.55 kb (504.00  b…919.43 kb)

Lattice - 90% dense updates  356.99 µs/iter 362.17 µs ▄▆      █▇▃
                    (343.17 µs … 387.46 µs) 379.71 µs ██▃▁▁▁▂▂███▇▆▄▃▃▂▂▁▁▁
                  gc(  1.43 ms …   2.92 ms) 504.00  b (504.00  b…504.00  b)

Lattice - 100% dense updates 400.91 µs/iter 403.58 µs         █▇▃
                    (383.17 µs … 433.50 µs) 420.83 µs ▂▂▂▂▃▃▃▆███▆▆▃▃▂▂▁▂▂▂
                  gc(  1.36 ms …   2.89 ms)   2.74 kb (456.00  b…152.99 kb)

Alien - 50% dense updates    149.69 µs/iter 153.21 µs  █▄
                    (143.83 µs … 219.04 µs) 165.58 µs ▆██▄▃▂▃▄▅▆▄▃▄▂▂▂▁▁▁▁▁
                  gc(  1.47 ms …   4.60 ms)  31.33 kb (504.00  b…  1.29 mb)

Alien - 75% dense updates    230.16 µs/iter 232.83 µs        █▂
                    (215.54 µs … 278.63 µs) 256.83 µs ▂▄▃▄▃▄▄██▅▃▃▃▂▁▂▁▁▁▁▁
                  gc(  1.38 ms …   2.55 ms)  18.19 kb (504.00  b…138.49 kb)

Alien - 90% dense updates    271.07 µs/iter 274.79 µs           █▂
                    (257.79 µs … 294.08 µs) 287.25 µs ▃█▅▃▂▃▄▆▅███▆▄▅▄▃▂▁▁▁
                  gc(  1.42 ms …   2.88 ms)   4.86 kb (488.00  b…136.99 kb)

Alien - 100% dense updates   296.09 µs/iter 299.46 µs  ▂     ▄█
                    (282.88 µs … 324.46 µs) 320.50 µs ▅█▂▁▁▁▁██▇▄▃▃▂▂▁▁▂▁▁▁
                  gc(  1.43 ms …   2.81 ms)   3.47 kb (504.00  b… 64.49 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■ 161.93 µs
  Preact - 75% dense updates ┤■■■■■■■■■■ 226.89 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■ 275.29 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 317.53 µs
 Lattice - 50% dense updates ┤■■■■■■■ 201.30 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 304.79 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 356.99 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 400.91 µs
   Alien - 50% dense updates ┤ 149.69 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■ 230.16 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■ 271.07 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■ 296.09 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.07…+1.08x faster than Preact - $changeRatio% dense updates
   +1.35…+1.34x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.39s

Running: diamond-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       650.45 µs/iter 657.92 µs     █
                      (617.96 µs … 1.71 ms) 716.54 µs     █▅  ▆
                    (456.00  b … 271.95 kb)   1.02 kb ▂▁▂▅██▃▂█▅▁▂▂▁▁▁▁▁▁▁▁

Lattice                        1.23 ms/iter   1.22 ms ▆█
                        (1.17 ms … 4.32 ms)   2.05 ms ██
                    (488.00  b … 712.49 kb)   1.76 kb ██▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        607.02 µs/iter 608.04 µs     █
                    (589.83 µs … 720.71 µs) 657.21 µs   █▅█▆
                    (504.00  b … 316.99 kb) 785.73  b ▁▂████▄▃█▄▄▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■ 650.45 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.23 ms
                       Alien ┤ 607.02 µs
                             └                                            ┘

summary
  Alien
   1.07x faster than Preact
   2.03x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       334.15 µs/iter 336.46 µs      █
                    (319.42 µs … 501.92 µs) 356.96 µs      ██▂
                    ( 16.74 kb … 567.09 kb)  56.72 kb ▁▁▁▂▁████▃▃█▃▅▃▁▁▁▁▁▁

Lattice                      367.52 µs/iter 368.42 µs     █
                    (352.17 µs … 634.58 µs) 405.71 µs     █
                    ( 53.68 kb …   1.39 mb)  57.43 kb ▁▁▁▂██▅▄▂▂▂▂▂▁▁▁▁▁▁▁▁

Alien                        293.87 µs/iter 297.29 µs    █
                    (279.58 µs … 453.25 µs) 327.96 µs    █▆
                    ( 16.46 kb … 500.18 kb)  56.33 kb ▁▁▁██▄▅▃▄▂▁▇▃▂▂▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■ 334.15 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 367.52 µs
                       Alien ┤ 293.87 µs
                             └                                            ┘

summary
  Alien
   1.14x faster than Preact
   1.25x faster than Lattice

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       717.82 µs/iter 716.88 µs     █
                    (701.25 µs … 767.00 µs) 758.29 µs    ▃█▅
                    (504.00  b … 799.06 kb)   1.55 kb ▁▁▂███▃▃▂▂▂▃▄▂▁▁▁▁▁▁▁

Lattice                        1.24 ms/iter   1.23 ms     ██
                        (1.19 ms … 1.48 ms)   1.36 ms     ██
                    (456.00  b …   2.34 mb)   5.79 kb ▁▁▁▃██▃▂▂▃▂▁▁▁▁▁▁▁▁▁▁

Alien                        618.30 µs/iter 616.54 µs    █
                    (591.58 µs … 789.25 µs) 731.67 µs    █
                    ( 43.36 kb …   1.37 mb) 393.15 kb ▁▁▇█▃▅▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■ 717.82 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.24 ms
                       Alien ┤ 618.30 µs
                             └                                            ┘

summary
  Alien
   1.16x faster than Preact
   2x faster than Lattice
  ✓ Completed in 10.81s

Running: effect-triggers

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       320.84 µs/iter 322.75 µs       █
                    (277.58 µs … 595.33 µs) 403.08 µs       █
                    (648.00  b …   1.96 mb) 157.29 kb ▁▁▁▁▁▁██▄▂▂▁▁▁▁▁▁▁▁▁▁

Lattice                      375.78 µs/iter 375.83 µs        █
                    (330.88 µs … 591.17 µs) 447.21 µs        █▅
                    (504.00  b … 617.93 kb) 155.15 kb ▁▁▁▁▁▁▁██▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        267.80 µs/iter 268.42 µs         █
                    (206.79 µs … 481.21 µs) 341.38 µs         █
                    (504.00  b …   1.68 mb) 157.26 kb ▁▁▁▁▁▁▁▁██▂▂▆▂▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■ 320.84 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 375.78 µs
                       Alien ┤ 267.80 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   1.4x faster than Lattice

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          211.75 µs/iter 211.75 µs      █
                    (201.83 µs … 325.83 µs) 237.54 µs    ▄▇█
                    (120.00  b … 990.97 kb)   1.79 kb ▂▁▃███▄▅▂▇▂▁▂▁▁▁▁▁▁▁▁

Lattice - 10 effects         242.17 µs/iter 242.46 µs   █
                    (234.38 µs … 618.63 µs) 272.21 µs   █ ▇
                    (120.00  b … 690.49 kb)   1.98 kb ▁▁█▃█▅▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien - 10 effects           222.74 µs/iter 223.63 µs      █
                    (214.71 µs … 286.04 µs) 238.92 µs      █▃
                    (104.00  b … 899.80 kb)   1.65 kb ▁▁▁▃▂███▄▃▃▃▂▂▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤ 211.75 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 242.17 µs
          Alien - 10 effects ┤■■■■■■■■■■■■ 222.74 µs
                             └                                            ┘

summary
  Preact - 10 effects
   1.05x faster than Alien - 10 effects
   1.14x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         7.65 µs/iter   7.50 µs   █
                      (7.00 µs … 168.29 µs)  10.42 µs   █
                    (312.00  b … 604.27 kb)  20.61 kb ▁▃██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                       11.88 µs/iter   7.92 µs  █
                        (7.17 µs … 2.78 ms)  18.67 µs  █
                    (336.00  b … 394.02 kb)  23.80 kb ▂█▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          5.69 µs/iter   5.70 µs        █
                        (5.65 µs … 5.77 µs)   5.76 µs ▅ ▅    █   ▅
                    (610.09  b …   3.53 kb)   2.95 kb ███▅▅▅██▁█▁█▁▁▁▁▁▁▅▁▅

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■ 7.65 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 11.88 µs
                       Alien ┤ 5.69 µs
                             └                                            ┘

summary
  Alien
   1.34x faster than Preact
   2.09x faster than Lattice
  ✓ Completed in 10.88s

Running: filtered-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        296.53 µs/iter 313.96 µs  █
                    (283.79 µs … 351.92 µs) 334.46 µs  █
                    (120.00  b … 544.40 kb)   1.50 kb ▁█▇▂▁▁▁▁▁▁▁▁▅▂▁▁▅▂▁▁▁

Lattice - 90% filtered       508.74 µs/iter 508.96 µs    █
                    (499.75 µs … 654.83 µs) 537.00 µs    █▂▄
                    (504.00  b … 441.49 kb)   1.36 kb ▂▁▁███▃▂▁▁▁▁▂▁▂▁▁▁▁▁▁

Alien - 90% filtered         297.91 µs/iter 288.38 µs   █
                    (273.13 µs … 411.58 µs) 382.17 µs   █
                    ( 48.00  b … 448.40 kb)   1.66 kb ▁▃█▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▁▂

                             ┌                                            ┐
       Preact - 90% filtered ┤ 296.53 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 508.74 µs
        Alien - 90% filtered ┤ 297.91 µs
                             └                                            ┘

summary
  Preact - 90% filtered
   1x faster than Alien - 90% filtered
   1.72x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       900.78 µs/iter 898.75 µs     █
                      (866.04 µs … 1.07 ms) 999.79 µs     █
                    (234.87 kb … 478.96 kb) 235.19 kb ▁▁▁▁█▇▃▃▂▂▂▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter        1.24 ms/iter   1.24 ms  █
                        (1.22 ms … 1.40 ms)   1.32 ms  █▂
                    (234.87 kb … 863.63 kb) 236.75 kb ▆██▃▂▂▁▁▅▃▁▁▁▁▁▁▁▁▁▁▁

Alien - toggle filter        819.77 µs/iter 818.04 µs   █
                    (802.96 µs … 964.33 µs) 903.04 µs   ██
                    (196.15 kb … 573.87 kb) 235.43 kb ▁▁██▄▂▁▂▂▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■ 900.78 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.24 ms
       Alien - toggle filter ┤ 819.77 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.1x faster than Preact - toggle filter
   1.51x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       427.61 µs/iter 427.54 µs    █
                    (419.58 µs … 487.33 µs) 451.67 µs    █
                    (504.00  b … 222.26 kb) 839.00  b ▁▁▁█▂█▂▂▂▄▁▂▂▁▁▁▁▁▁▁▁

Lattice                      782.16 µs/iter 787.29 µs    █
                    (764.33 µs … 971.25 µs) 818.29 µs    █▇   ▅▃
                    (456.00  b … 871.26 kb)   2.28 kb ▁▁▁██▄▂▆██▃▂▄▁▂▁▁▁▂▂▁

Alien                        419.96 µs/iter 426.50 µs       █
                    (404.13 µs … 562.63 µs) 441.38 µs       █
                    (504.00  b … 352.99 kb) 766.19  b ▁▁▁▁▁▃██▅▃▁▂█▂▅▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■ 427.61 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 782.16 µs
                       Alien ┤ 419.96 µs
                             └                                            ┘

summary
  Alien
   1.02x faster than Preact
   1.86x faster than Lattice
  ✓ Completed in 10.80s

Running: scaling-subscribers

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       16.45 µs/iter  15.38 µs █
                      (14.75 µs … 45.08 µs)  35.83 µs █▃▁▃▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   3.00 ms)   6.36 kb (456.00  b…437.58 kb)

Preact - 50 subscribers       27.90 µs/iter  26.83 µs █
                      (26.17 µs … 84.17 µs)  44.63 µs █▇▁▁▁▁▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   2.80 ms)   7.96 kb (456.00  b…294.73 kb)

Preact - 100 subscribers      50.43 µs/iter  50.69 µs               █     █
                      (49.66 µs … 51.15 µs)  50.73 µs █▁▁▁▁▁█▁▁▁▁████▁█▁▁██
                  gc(  2.48 ms …   3.53 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     114.00 µs/iter 114.33 µs    ▃▄▄█
                    (104.08 µs … 135.83 µs) 133.04 µs ▃▃▇████▇▂▁▂▃▂▄▃▃▃▃▂▂▂
                  gc(  1.50 ms …   2.91 ms)  23.91 kb (456.00  b…156.95 kb)

Preact - 400 subscribers     294.19 µs/iter 299.63 µs        ▃█▃▂
                    (269.17 µs … 328.25 µs) 320.25 µs ▁▂▃▁▃▃███████▆▅▅▃▂▃▂▁
                  gc(  1.38 ms …   2.26 ms)   4.84 kb (456.00  b…104.95 kb)

Lattice - 25 subscribers      19.26 µs/iter  18.54 µs  █
                      (17.04 µs … 61.13 µs)  41.29 µs ██▄▁▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   3.34 ms)   4.93 kb (504.00  b…203.27 kb)

Lattice - 50 subscribers      37.98 µs/iter  38.12 µs  ▂  █
                     (35.62 µs … 144.54 µs)  47.33 µs ▆██▇█▄▂▁▁▂▁▂▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   3.11 ms)   8.21 kb (152.00  b…348.65 kb)

Lattice - 100 subscribers     70.63 µs/iter  70.50 µs  █
                      (69.96 µs … 84.37 µs)  78.54 µs ▅█▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   2.84 ms)   6.46 kb (504.00  b…124.99 kb)

Lattice - 200 subscribers    142.59 µs/iter 142.75 µs  ▃█▆▂
                    (141.08 µs … 154.33 µs) 149.38 µs ▂████▅▃▂▂▂▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   2.37 ms)  24.43 kb (504.00  b…156.99 kb)

Lattice - 400 subscribers    346.25 µs/iter 353.08 µs     ▅▆█▄    ▃
                    (327.75 µs … 378.25 µs) 370.67 µs ▂▂▃▆████▇▆███▇▆▄▄▃▂▂▂
                  gc(  1.38 ms …   2.69 ms)   1.05 kb (456.00  b… 40.49 kb)

Alien - 25 subscribers        14.51 µs/iter  14.17 µs  █
                      (13.00 µs … 44.00 µs)  28.83 µs ▇█▄▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   2.82 ms)   4.82 kb (488.00  b…118.32 kb)

Alien - 50 subscribers        24.99 µs/iter  25.01 µs █     █ █ ██ █ █  █ █
                      (24.82 µs … 25.21 µs)  25.07 µs █▁▁▁▁▁█▁█▁██▁█▁█▁▁█▁█
                  gc(  2.05 ms …   3.38 ms)  19.31  b (  0.10  b…258.48  b)

Alien - 100 subscribers       50.04 µs/iter  50.10 µs █      █ ██
                      (49.83 µs … 50.39 µs)  50.20 µs █▁▁▁▁▁▁█▁██▁▁▁█▁▁▁█▁█
                  gc(  2.53 ms …   2.89 ms)   0.11  b (  0.10  b…  0.12  b)

Alien - 200 subscribers      109.21 µs/iter 111.54 µs  ▆        ▄█▄
                    (104.38 µs … 120.29 µs) 117.63 µs ▇█▄▃▇▇▆▅█████▃▁▂▂▁▁▁▁
                  gc(  1.57 ms …   2.47 ms)  22.72 kb (504.00  b…156.99 kb)

Alien - 400 subscribers      317.88 µs/iter 322.13 µs   ▆█▃
                    (285.42 µs … 831.71 µs) 461.96 µs ▂▇███▆▄▃▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   7.06 ms)  11.82 kb (504.00  b…155.49 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 16.45 µs
     Preact - 50 subscribers ┤■ 27.90 µs
    Preact - 100 subscribers ┤■■■■ 50.43 µs
    Preact - 200 subscribers ┤■■■■■■■■■■ 114.00 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 294.19 µs
    Lattice - 25 subscribers ┤ 19.26 µs
    Lattice - 50 subscribers ┤■■ 37.98 µs
   Lattice - 100 subscribers ┤■■■■■■ 70.63 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■■ 142.59 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 346.25 µs
      Alien - 25 subscribers ┤ 14.51 µs
      Alien - 50 subscribers ┤■ 24.99 µs
     Alien - 100 subscribers ┤■■■■ 50.04 µs
     Alien - 200 subscribers ┤■■■■■■■■■■ 109.21 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 317.88 µs
                             └                                            ┘

summary
  Preact - $sources subscribers
   +1.08…-1.13x faster than Alien - $sources subscribers
   +1.18…+1.17x faster than Lattice - $sources subscribers
  ✓ Completed in 32.85s

Running: signal-updates

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          354.47 µs/iter 320.58 µs █
                    (313.96 µs … 790.13 µs) 593.25 µs █
                    (408.00  b … 354.23 kb)   1.09 kb █▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▄▂▁

Lattice - write only         234.61 µs/iter 405.17 µs █
                     (94.67 µs … 494.33 µs) 457.71 µs █                ▂
                    (120.00  b … 760.90 kb)   1.40 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▅▅▁

Alien - write only            71.13 µs/iter  47.42 µs █
                     (45.42 µs … 605.04 µs) 564.46 µs █
                    ( 48.00  b … 685.40 kb) 486.36  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           244.92 µs/iter 405.58 µs █
                     (95.75 µs … 460.67 µs) 435.67 µs █                 ▄
                    ( 48.00  b … 544.40 kb)   1.15 kb █▁▁▁▁▁▁▁█▁▁▁▁▁▁▁▁▁██▄

Lattice - read only          214.46 µs/iter 402.21 µs █                  ▅
                     (38.54 µs … 446.67 µs) 416.71 µs █                  █
                    ( 32.00  b … 405.40 kb)   1.20 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▂

Alien - read only             92.68 µs/iter  60.04 µs █
                     (59.21 µs … 642.67 µs) 597.33 µs █
                    ( 48.00  b … 717.40 kb) 497.35  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▂▁

Preact - read/write mixed    380.65 µs/iter 338.08 µs █
                    (325.33 µs … 872.54 µs) 850.46 µs █
                    (408.00  b … 288.49 kb) 947.21  b █▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▂

Lattice - read/write mixed   309.00 µs/iter 753.54 µs █
                     (94.67 µs … 820.38 µs) 788.71 µs █
                    ( 48.00  b … 639.90 kb)   1.45 kb █▁▁▁▁▁▅▄▁▁▁▁▁▁▁▁▁▁▁▇▅

Alien - read/write mixed     349.61 µs/iter 207.92 µs █
                      (127.67 µs … 1.48 ms)   1.42 ms █
                    (408.00  b … 160.49 kb) 680.46  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 354.47 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 234.61 µs
          Alien - write only ┤ 71.13 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■■ 244.92 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 214.46 µs
           Alien - read only ┤■■ 92.68 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 380.65 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.00 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 349.61 µs
                             └                                            ┘

summary
  Alien - write only
   1.3x faster than Alien - read only
   3.02x faster than Lattice - read only
   3.3x faster than Lattice - write only
   3.44x faster than Preact - read only
   4.34x faster than Lattice - read/write mixed
   4.92x faster than Alien - read/write mixed
   4.98x faster than Preact - write only
   5.35x faster than Preact - read/write mixed
  ✓ Completed in 10.84s

Running: sparse-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   38.03 µs/iter  36.67 µs  █
                     (34.67 µs … 109.54 µs)  73.00 µs ▇█▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.49 ms …   3.32 ms)   9.10 kb (456.00  b…283.25 kb)

Preact - 15% sparse updates   45.23 µs/iter  43.96 µs █
                      (43.25 µs … 76.71 µs)  68.88 µs █▃▁▁▂▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.75 ms)   6.69 kb (456.00  b…263.15 kb)

Preact - 20% sparse updates   56.48 µs/iter  56.78 µs                   █ █
                      (55.67 µs … 56.98 µs)  56.84 µs █▁█▁▁▁▁▁█▁▁█▁██▁▁▁███
                  gc(  2.51 ms …   5.44 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   75.73 µs/iter  76.88 µs ▃   ▄█ ▄
                      (72.54 µs … 98.50 µs)  86.67 µs ██▅▇████▄▂▂▂▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.83 ms)   9.96 kb (456.00  b…132.95 kb)

Lattice - 10% sparse updates  41.57 µs/iter  40.33 µs █
                      (39.54 µs … 93.13 µs)  81.92 µs █▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   2.92 ms)  13.25 kb (504.00  b…  1.03 mb)

Lattice - 15% sparse updates  59.79 µs/iter  59.50 µs  █
                      (58.83 µs … 76.00 µs)  66.96 µs ▂█▆▂▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.93 ms)  10.88 kb (504.00  b…158.59 kb)

Lattice - 20% sparse updates  78.62 µs/iter  78.62 µs  █▂
                      (77.96 µs … 92.63 µs)  85.17 µs ▄██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   3.05 ms)  18.82 kb (504.00  b…132.99 kb)

Lattice - 25% sparse updates  98.92 µs/iter  98.75 µs   █▂
                     (97.50 µs … 113.54 µs) 104.33 µs ▃███▄▂▁▁▁▂▂▃▂▁▂▁▁▁▁▁▁
                  gc(  1.41 ms …   3.09 ms)  20.69 kb (504.00  b…124.99 kb)

Alien - 10% sparse updates    30.80 µs/iter  30.00 µs █
                      (29.38 µs … 84.29 µs)  60.42 µs █▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.44 ms …   3.66 ms)   7.66 kb (456.00  b…163.29 kb)

Alien - 15% sparse updates    44.04 µs/iter  44.04 µs  █▅
                      (43.54 µs … 55.42 µs)  48.00 µs ▂██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   3.06 ms)   7.46 kb (440.00  b… 52.95 kb)

Alien - 20% sparse updates    55.83 µs/iter  55.87 µs   █      █
                      (55.38 µs … 56.69 µs)  56.44 µs ████▁██▁▁█▁▁▁▁▁▁▁▁▁██
                  gc(  2.46 ms …   4.92 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    77.32 µs/iter  78.25 µs      ██▄
                     (72.83 µs … 104.92 µs)  89.42 µs ▅▅▂▃▇███▄▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.33 ms …   2.91 ms)   7.33 kb (456.00  b…132.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■■■ 38.03 µs
 Preact - 15% sparse updates ┤■■■■■■■ 45.23 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■ 56.48 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■ 75.73 µs
Lattice - 10% sparse updates ┤■■■■■ 41.57 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■■ 59.79 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■ 78.62 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 98.92 µs
  Alien - 10% sparse updates ┤ 30.80 µs
  Alien - 15% sparse updates ┤■■■■■■■ 44.04 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■ 55.83 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 77.32 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   -1.02…+1.23x faster than Preact - $changeRatio% sparse updates
   +1.28…+1.35x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.34s

Running: wide-fanout

clk: ~3.08 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       307.90 µs/iter 308.54 µs    █
                    (301.21 µs … 460.96 µs) 328.21 µs    █ ▅
                    ( 54.80 kb … 567.09 kb)  56.58 kb ▁▁▄█▃█▆▃▂▁▂▁▁▁▁▁▁▁▁▁▁

Lattice                      353.38 µs/iter 352.83 µs     █
                    (339.00 µs … 515.75 µs) 397.38 µs     █▄
                    (  4.68 kb …   1.09 mb)  57.63 kb ▁▁▁▁██▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        296.24 µs/iter 299.58 µs   █
                    (288.58 µs … 431.79 µs) 321.71 µs  ██
                    (  2.68 kb … 599.09 kb)  56.77 kb ▁███▄▂▄▇▂▄▇▃▂▂▁▁▂▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 307.90 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 353.38 µs
                       Alien ┤ 296.24 µs
                             └                                            ┘

summary
  Alien
   1.04x faster than Preact
   1.19x faster than Lattice

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       363.85 µs/iter 363.42 µs   █
                    (356.33 µs … 604.33 µs) 392.00 µs   ██▂
                    (  5.87 kb …   1.58 mb)   8.10 kb ▁▁███▄▂▂▂▂▂▁▂▁▁▁▁▁▁▁▁

Lattice                      266.84 µs/iter 267.25 µs   ██
                    (256.54 µs … 371.04 µs) 314.42 µs   ██
                    (  5.59 kb … 739.46 kb)   8.78 kb ▁▁██▆█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        299.48 µs/iter 299.13 µs  █
                    (293.96 µs … 382.17 µs) 350.08 µs  █
                    (  5.52 kb … 549.87 kb)   7.96 kb ▄█▆▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 363.85 µs
                     Lattice ┤ 266.84 µs
                       Alien ┤■■■■■■■■■■■ 299.48 µs
                             └                                            ┘

summary
  Lattice
   1.12x faster than Alien
   1.36x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       258.47 µs/iter 257.92 µs    █▃
                    (248.92 µs … 310.96 µs) 286.25 µs    ██
                    (  5.59 kb … 421.87 kb)   7.19 kb ▁▁▁██▆▅▂▂▂▂▂▁▁▁▁▁▁▁▁▁

Lattice                      151.14 µs/iter 152.75 µs  █
                    (146.38 µs … 324.63 µs) 185.42 µs  █
                    (  5.52 kb …   1.02 mb)   8.67 kb ▁█▃█▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        255.58 µs/iter 255.63 µs   █
                    (250.21 µs … 311.33 µs) 287.71 µs   █
                    (  5.52 kb …   1.12 mb)   7.60 kb ▁▅█▆▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 258.47 µs
                     Lattice ┤ 151.14 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 255.58 µs
                             └                                            ┘

summary
  Lattice
   1.69x faster than Alien
   1.71x faster than Preact
  ✓ Completed in 10.81s

Running: write-heavy

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        55.22 µs/iter  54.79 µs   █
                      (53.96 µs … 98.04 µs)  63.21 µs   █
                    ( 32.00  b … 656.32 kb) 891.53  b ▁▆█▁▁▂▁▁▂▁▁▁▁▁▁▁▂▁▁▁▁

Lattice                      142.22 µs/iter 142.96 µs     █
                    (136.04 µs … 210.96 µs) 156.13 µs     █
                    ( 32.00  b … 559.25 kb)   1.96 kb ▁▁▁▁█▄▁▃▁▄▁▁▁▁▁▃▁▁▁▁▁

Alien                         45.87 µs/iter  44.42 µs  █
                     (42.96 µs … 137.83 µs)  83.79 µs  █
                    ( 32.00  b …   1.00 mb) 702.48  b ▁█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 55.22 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 142.22 µs
                       Alien ┤ 45.87 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   3.1x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        48.82 µs/iter  48.08 µs   █
                      (46.54 µs … 92.54 µs)  59.50 µs   █
                    ( 32.00  b … 356.99 kb) 893.86  b ▁▁█▃▁▃▁▁▁▁▁▁▁▁▂▁▁▁▁▁▁

Lattice                      133.75 µs/iter 132.96 µs   █
                    (130.33 µs … 173.67 µs) 148.54 µs   █
                    ( 48.00  b … 612.49 kb)   2.23 kb ▁▁█▃▂▄▂▂▁▁▁▁▁▁▃▁▁▁▁▁▁

Alien                         40.18 µs/iter  39.00 µs  █
                      (37.75 µs … 96.67 µs)  77.79 µs  █
                    ( 32.00  b … 214.49 kb) 576.44  b ▂█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 48.82 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 133.75 µs
                       Alien ┤ 40.18 µs
                             └                                            ┘

summary
  Alien
   1.22x faster than Preact
   3.33x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        95.62 µs/iter  96.79 µs    █
                     (91.04 µs … 243.79 µs) 112.33 µs    █
                    (  5.52 kb … 841.46 kb)   6.87 kb ▁▁▃█▂▇▆▁▂▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      221.67 µs/iter 215.92 µs  █
                      (194.63 µs … 1.71 ms) 563.71 µs  █
                    (  5.59 kb … 572.02 kb)   8.15 kb ▆█▂▅▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        137.04 µs/iter 137.33 µs    █
                    (131.58 µs … 286.33 µs) 152.17 µs    █
                    (  5.50 kb … 582.07 kb)   7.05 kb ▁▁▁██▃▃▃▄▂▁▁▁▁▄▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 95.62 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 221.67 µs
                       Alien ┤■■■■■■■■■■■ 137.04 µs
                             └                                            ┘

summary
  Preact
   1.43x faster than Alien
   2.32x faster than Lattice
  ✓ Completed in 10.81s

Summary:
  Total: 12
  Success: 12
  Failed: 0