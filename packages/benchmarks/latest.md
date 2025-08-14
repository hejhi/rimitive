Found 14 benchmark suites

Running: batch-operations

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       543.45 µs/iter 540.17 µs    █
                    (518.63 µs … 680.79 µs) 623.29 µs    █▇
                    ( 11.04 kb …   1.26 mb) 937.42 kb ▁▁▁██▃▂▂▂▁▁▁▁▁▁▁▂▂▁▁▁

Lattice                      763.96 µs/iter 760.46 µs     █
                    (732.96 µs … 885.08 µs) 852.83 µs    ▂█
                    (414.73 kb …   1.31 mb) 938.68 kb ▁▁▁██▃▂▂▃▁▂▁▁▁▁▂▂▁▁▁▁

Alien                        428.53 µs/iter 429.25 µs       █▅
                    (407.42 µs … 568.17 µs) 458.83 µs       ██
                    (456.00  b … 352.99 kb) 970.52  b ▁▁▁▁▁▁███▄▃▂▇▃▂▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■ 543.45 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 763.96 µs
                       Alien ┤ 428.53 µs
                             └                                            ┘

summary
  Alien
   1.27x faster than Preact
   1.78x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       131.31 µs/iter 131.29 µs  █
                    (123.92 µs … 302.71 µs) 205.92 µs  █
                    ( 43.62 kb … 642.75 kb) 204.39 kb ▁██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      260.93 µs/iter 260.38 µs   █
                    (249.96 µs … 450.33 µs) 339.46 µs   █
                    ( 63.71 kb … 942.58 kb) 205.99 kb ▁▁█▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        218.00 µs/iter 217.75 µs   █
                    (208.29 µs … 386.08 µs) 287.88 µs   █
                    ( 45.38 kb … 811.50 kb) 150.28 kb ▂▁█▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 131.31 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 260.93 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■ 218.00 µs
                             └                                            ┘

summary
  Preact
   1.66x faster than Alien
   1.99x faster than Lattice

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       410.75 µs/iter 414.50 µs   █▆
                    (390.29 µs … 561.58 µs) 498.21 µs   ██ ▃
                    (800.00  b …   1.21 mb) 516.20 kb ▂▁██▄█▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      690.32 µs/iter 687.33 µs   █
                    (666.92 µs … 880.50 µs) 800.13 µs   █
                    (  5.94 kb …   1.47 mb) 517.85 kb ▁▁██▃▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        436.45 µs/iter 436.71 µs     █
                    (418.88 µs … 638.42 µs) 483.00 µs     █▂
                    ( 71.19 kb … 693.87 kb) 110.73 kb ▂▁▁▁██▄▂▆▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 410.75 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 690.32 µs
                       Alien ┤■■■ 436.45 µs
                             └                                            ┘

summary
  Preact
   1.06x faster than Alien
   1.68x faster than Lattice
  ✓ Completed in 10.88s

Running: computed-chains

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       403.90 µs/iter 403.13 µs     █
                    (390.79 µs … 451.92 µs) 438.17 µs     █
                    (408.00  b … 288.45 kb) 921.63  b ▁▁▁▁██▂▂▁▅▁▁▁▁▁▁▁▁▁▁▁

Lattice                      544.00 µs/iter 544.46 µs         █
                    (525.25 µs … 625.54 µs) 566.46 µs         █▃
                    (504.00  b … 323.99 kb)   1.02 kb ▁▁▁▁▁▁▁▁██▃▄▂▂▁▁▂▁▁▁▁

Alien                        381.77 µs/iter 375.17 µs     █
                    (343.71 µs … 494.67 µs) 480.58 µs     █▂
                    (408.00  b … 287.49 kb)   1.05 kb ▁▁▂▂██▂▁▁▁▁▁▁▁▁▁▁▁▁▃▂

                             ┌                                            ┐
                      Preact ┤■■■■■ 403.90 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 544.00 µs
                       Alien ┤ 381.77 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Preact
   1.42x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       221.24 µs/iter 223.58 µs     █
                    (210.17 µs … 282.75 µs) 243.17 µs     █  ▇
                    (104.00  b … 413.90 kb)   1.51 kb ▁▁▁▁█▂▅█▇▃▃▂▂▂▁▁▂▁▁▁▁

Lattice                      322.95 µs/iter 324.04 µs  █
                    (318.58 µs … 535.67 µs) 341.42 µs ▇█ ▃
                    (120.00  b … 777.99 kb)   1.97 kb ██▂██▆▄▂▂▄▃▂▂▂▂▂▁▁▁▁▁

Alien                        224.46 µs/iter 227.17 µs     ▂█
                    (214.83 µs … 270.42 µs) 244.50 µs     ██
                    ( 48.00  b … 416.40 kb)   1.62 kb ▂▁▁▃██▅▅▂▄▄▇▂▂▂▂▂▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 221.24 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 322.95 µs
                       Alien ┤■ 224.46 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.46x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       111.84 µs/iter 111.58 µs        █
                    (107.29 µs … 270.63 µs) 118.88 µs      ▃ █
                    (120.00  b …   1.10 mb)   1.16 kb ▁▁▁▁▁█▃█▃▁▂▂▃▂▂▁▁▁▁▁▁

Lattice                      148.36 µs/iter 147.79 µs    █
                    (142.29 µs … 506.96 µs) 172.33 µs    █
                    ( 48.00  b … 509.99 kb)   1.45 kb ▁▁▁█▃▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        105.30 µs/iter 107.08 µs      ██
                    (101.00 µs … 126.21 µs) 112.29 µs      ██
                    ( 48.00  b … 259.40 kb) 782.15  b ▁▁▁▁▁██▁▁▁▃█▅▁▁▃▃▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■ 111.84 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 148.36 µs
                       Alien ┤ 105.30 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Preact
   1.41x faster than Lattice
  ✓ Completed in 10.81s

Running: conditional-deps

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       617.77 µs/iter 615.87 µs █▃
                    (605.50 µs … 739.96 µs) 703.46 µs ██
                    (400.91 kb …   1.34 mb) 860.21 kb ██▅▃▅▃▁▁▂▁▁▁▂▁▁▂▂▂▁▁▁

Lattice                      616.06 µs/iter 621.46 µs    █   ▂
                    (584.71 µs … 714.46 µs) 682.71 µs    ██ ▃█
                    (504.00  b … 721.49 kb)   1.15 kb ▂▂▆██▇██▇▄▄▃▃▃▃▃▂▂▂▁▁

Alien                          1.07 ms/iter 629.63 µs █
                     (594.79 µs … 13.02 ms)  11.64 ms █
                    (114.23 kb …   1.16 mb) 702.57 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 617.77 µs
                     Lattice ┤ 616.06 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.07 ms
                             └                                            ┘

summary
  Lattice
   1x faster than Preact
   1.74x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       972.30 µs/iter 972.92 µs     █
                      (928.67 µs … 1.16 ms)   1.08 ms     █
                    (284.57 kb …   1.33 mb) 858.98 kb ▁▁▁▃█▆▃▃▃▂▂▁▁▁▂▁▁▁▁▁▁

Lattice                        1.40 ms/iter   1.40 ms      ▇ █
                        (1.36 ms … 1.60 ms)   1.47 ms     ▅███
                    (504.00  b … 876.88 kb)   3.84 kb ▁▁▁▁████▅▃▂▂▃▂▂▄▆▁▁▂▁

Alien                          1.34 ms/iter 926.79 µs █
                     (892.17 µs … 12.02 ms)  11.55 ms █
                    (249.75 kb …   1.13 mb) 702.96 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 972.30 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.40 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.34 ms
                             └                                            ┘

summary
  Preact
   1.38x faster than Alien
   1.44x faster than Lattice
  ✓ Completed in 8.69s

Running: dense-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   179.42 µs/iter 184.75 µs  █    ▄
                    (166.25 µs … 297.88 µs) 221.75 µs ▆█▆▂▃▄██▄▂▂▂▁▁▂▁▁▁▁▁▁
                  gc(  1.39 ms …   4.69 ms)  14.09 kb (456.00  b…  1.25 mb)

Preact - 75% dense updates   229.23 µs/iter 228.58 µs  ▄█▇
                    (223.08 µs … 348.17 µs) 259.25 µs ▆███▄▃▁▁▁▁▁▂▂▁▂▁▁▁▁▁▁
                  gc(  1.36 ms …   4.88 ms)  15.61 kb (456.00  b…894.49 kb)

Preact - 90% dense updates   280.80 µs/iter 286.25 µs  ▇     █
                    (266.88 µs … 322.04 µs) 309.75 µs ▅█▂▁▁▁▅█▅▆▄▅▂▃▂▁▁▁▂▂▁
                  gc(  1.35 ms …   2.52 ms)   2.26 kb (456.00  b… 92.95 kb)

Preact - 100% dense updates  315.53 µs/iter 319.08 µs        █▇▄
                    (299.00 µs … 348.04 µs) 339.38 µs ▄▆▄▃▁▁▁███▇▆▄▃▂▁▂▂▂▁▂
                  gc(  1.33 ms …   2.61 ms) 949.04  b (456.00  b… 19.95 kb)

Lattice - 50% dense updates  204.16 µs/iter 204.88 µs    █ ▄▅
                    (194.38 µs … 392.67 µs) 229.00 µs ▁▁▂████▅▂▁▁▂▂▁▂▁▁▁▁▁▁
                  gc(  1.41 ms …   4.55 ms)  27.49 kb (504.00  b…  1.15 mb)

Lattice - 75% dense updates  304.76 µs/iter 309.13 µs █  ▃▄
                    (287.08 µs … 727.33 µs) 394.79 µs █▇▃██▆▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   8.39 ms)  28.70 kb (504.00  b…635.36 kb)

Lattice - 90% dense updates  355.22 µs/iter 361.88 µs  █     ▆▃ ▄
                    (339.79 µs … 408.79 µs) 384.67 µs ██▄▁▁▁▁█████▃▁▁▂▂▂▁▁▁
                  gc(  1.39 ms …   2.86 ms)   1.01 kb (504.00  b… 40.49 kb)

Lattice - 100% dense updates 394.06 µs/iter 398.50 µs       ▇█ ▃
                    (375.67 µs … 438.58 µs) 425.88 µs ▇▅▂▁▁▁████▆▃▃▂▁▂▁▁▁▁▂
                  gc(  1.36 ms …   2.86 ms)   2.31 kb (456.00  b…129.66 kb)

Alien - 50% dense updates    149.02 µs/iter 148.46 µs  █▇▅
                    (144.08 µs … 220.17 µs) 173.71 µs ▃███▃▂▂▁▁▁▁▂▂▂▁▂▂▁▁▁▁
                  gc(  1.53 ms …   4.65 ms)  39.57 kb (504.00  b…  1.50 mb)

Alien - 75% dense updates    230.40 µs/iter 235.00 µs        █▂
                    (215.50 µs … 261.96 µs) 256.00 µs ▆▆▃▁▁▁▂██▄▅▃▃▂▂▂▂▁▂▁▁
                  gc(  1.37 ms …   2.74 ms)  26.41 kb (504.00  b…319.27 kb)

Alien - 90% dense updates    274.15 µs/iter 280.21 µs  █     ▄▂
                    (259.83 µs … 320.25 µs) 300.50 µs ▆█▃▂▁▁▁████▆▄▃▂▁▂▁▂▁▂
                  gc(  1.41 ms …   2.85 ms)   2.09 kb (504.00  b… 72.49 kb)

Alien - 100% dense updates   309.86 µs/iter 312.92 µs        █▃
                    (292.08 µs … 364.75 µs) 335.67 µs ▂▃▄▂▂▂▅███▆▄▃▃▁▂▁▂▁▁▁
                  gc(  1.40 ms …   2.30 ms) 770.24  b (504.00  b… 19.99 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■■■ 179.42 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■ 229.23 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■ 280.80 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 315.53 µs
 Lattice - 50% dense updates ┤■■■■■■■■ 204.16 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■ 304.76 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 355.22 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 394.06 µs
   Alien - 50% dense updates ┤ 149.02 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■ 230.40 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■ 274.15 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■ 309.86 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.02…+1.2x faster than Preact - $changeRatio% dense updates
   +1.27…+1.37x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.44s

Running: diamond-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       644.89 µs/iter 642.33 µs   █
                    (633.38 µs … 711.12 µs) 698.17 µs   █▆
                    (456.00  b … 241.71 kb) 787.96  b ▃▃██▃▁▁▂▂▂▂▁▁▁▁▁▁▁▁▁▁

Lattice                        1.19 ms/iter   1.20 ms      ▂█
                        (1.14 ms … 1.28 ms)   1.26 ms      ██
                    (504.00  b … 302.49 kb)   1.00 kb ▁▁▁▁▁██▆▅▄▄▃▃▃▂▃▂▂▂▂▁

Alien                        576.38 µs/iter 575.42 µs   █
                    (566.92 µs … 689.33 µs) 629.42 µs  ▆█▃
                    (504.00  b … 316.99 kb)   0.98 kb ▁███▄▂▂▂▁▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■ 644.89 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.19 ms
                       Alien ┤ 576.38 µs
                             └                                            ┘

summary
  Alien
   1.12x faster than Preact
   2.06x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       335.95 µs/iter 335.63 µs    █▆
                    (319.58 µs … 508.25 µs) 377.67 µs    ██▅
                    ( 16.74 kb … 631.09 kb)  56.76 kb ▂▁▁███▄▃▃▃▃▃▂▂▂▂▂▁▁▁▁

Lattice                      364.88 µs/iter 369.00 µs    █
                    (348.75 µs … 615.42 µs) 416.08 µs    █▃
                    ( 53.68 kb …   1.13 mb)  58.03 kb ▁▁▁██▄▄▄▅▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        296.36 µs/iter 304.88 µs    █
                    (281.21 µs … 461.92 µs) 335.75 µs    █
                    ( 16.46 kb …   0.99 mb)  56.94 kb ▁▁███▃▃▂▂█▄▂▂▂▂▁▂▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■ 335.95 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 364.88 µs
                       Alien ┤ 296.36 µs
                             └                                            ┘

summary
  Alien
   1.13x faster than Preact
   1.23x faster than Lattice

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       735.96 µs/iter 734.58 µs      █▃
                    (706.46 µs … 906.17 µs) 790.17 µs      ██
                    (504.00  b … 675.06 kb)   1.20 kb ▂▁▁▁▁██▆▃▂▂▄▂▁▂▁▂▂▁▂▁

Lattice                        1.24 ms/iter   1.23 ms   █
                        (1.22 ms … 1.39 ms)   1.31 ms  ▃█▅
                    (456.00  b …   2.12 mb)   5.51 kb ▂███▅▂▃▂▁▁▁▂▂▁▂▁▂▂▂▂▁

Alien                        613.01 µs/iter 609.33 µs █
                    (605.67 µs … 760.50 µs) 710.33 µs ██
                    (391.13 kb …   1.51 mb) 393.72 kb ██▂▂▂▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 735.96 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.24 ms
                       Alien ┤ 613.01 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   2.02x faster than Lattice
  ✓ Completed in 10.79s

Running: effect-triggers

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       321.68 µs/iter 322.96 µs       █▄
                    (273.46 µs … 587.04 µs) 402.21 µs       ██▄
                    (648.00  b …   1.98 mb) 157.76 kb ▂▁▁▁▁▁███▄▄▃▂▁▁▁▁▁▁▁▁

Lattice                      375.88 µs/iter 375.46 µs         █
                    (321.04 µs … 527.50 µs) 452.29 µs         █
                    (504.00  b … 616.74 kb) 155.11 kb ▁▁▁▁▁▁▁▁█▄▂▁▁▁▁▁▁▁▁▁▁

Alien                        269.07 µs/iter 272.42 µs      █
                    (234.92 µs … 525.96 µs) 346.13 µs      █
                    (504.00  b …   2.07 mb) 157.43 kb ▁▁▁▁▁█▃▂▂▅▃▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■ 321.68 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 375.88 µs
                       Alien ┤ 269.07 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   1.4x faster than Lattice

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          212.78 µs/iter 213.38 µs        █  ▅
                    (204.46 µs … 277.33 µs) 222.38 µs        █  █
                    (120.00  b … 973.73 kb)   1.62 kb ▁▁▁▁▁▁▁█▂██▂▂▅▂▂▂▂▁▁▁

Lattice - 10 effects         259.44 µs/iter 258.96 µs   ▆ █
                    (249.46 µs … 774.50 µs) 292.00 µs   █ █
                    (120.00  b … 529.99 kb)   1.94 kb ▁▁███▇▂▂▂▂▂▂▂▂▂▁▁▁▁▁▁

Alien - 10 effects           223.21 µs/iter 224.88 µs     █
                    (212.58 µs … 307.50 µs) 248.38 µs     █
                    (120.00  b … 936.10 kb)   1.77 kb ▁▁▁▁██▃▃▆▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤ 212.78 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 259.44 µs
          Alien - 10 effects ┤■■■■■■■■ 223.21 µs
                             └                                            ┘

summary
  Preact - 10 effects
   1.05x faster than Alien - 10 effects
   1.22x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         8.42 µs/iter   8.25 µs      █
                      (7.83 µs … 142.17 µs)   9.21 µs     ▄█
                    (312.00  b … 632.32 kb)  20.62 kb ▁▁▁▁██▅▄▃▂▂▁▁▁▁▁▁▁▁▁▁

Lattice                       11.75 µs/iter   8.04 µs  █
                        (7.33 µs … 2.71 ms)  20.13 µs  █
                    (624.00  b … 463.52 kb)  23.77 kb ▄█▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          6.40 µs/iter   6.25 µs      █
                      (5.83 µs … 154.63 µs)   7.08 µs      █▂▂
                    (216.00  b … 311.55 kb)  19.75 kb ▁▁▁▃████▄▄▂▂▂▂▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■ 8.42 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 11.75 µs
                       Alien ┤ 6.40 µs
                             └                                            ┘

summary
  Alien
   1.32x faster than Preact
   1.84x faster than Lattice
  ✓ Completed in 10.91s

Running: filtered-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        297.25 µs/iter 312.71 µs   █
                    (279.71 µs … 371.63 µs) 338.54 µs   █
                    (120.00  b … 384.40 kb)   1.53 kb ▁▁█▄▂▁▂▁▁▁▁▄▂▁▁▄▄▁▁▁▁

Lattice - 90% filtered       509.55 µs/iter 516.08 µs █
                    (499.25 µs … 568.08 µs) 555.67 µs █▃    ▂
                    (488.00  b … 441.49 kb)   1.57 kb ██▅▃▂▂█▃▂▂▂▂▂▂▂▁▁▁▁▁▁

Alien - 90% filtered         298.24 µs/iter 292.58 µs   █
                    (274.96 µs … 371.21 µs) 360.79 µs   █
                    ( 48.00  b … 480.40 kb)   1.42 kb ▁▁██▂▁▂▂▁▁▁▁▁▁▁▁▁▁▁▆▂

                             ┌                                            ┐
       Preact - 90% filtered ┤ 297.25 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 509.55 µs
        Alien - 90% filtered ┤ 298.24 µs
                             └                                            ┘

summary
  Preact - 90% filtered
   1x faster than Alien - 90% filtered
   1.71x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       839.13 µs/iter 838.00 µs    █
                    (815.50 µs … 982.54 µs) 921.71 µs    █
                    (164.98 kb … 237.98 kb) 234.79 kb ▁▁▂█▆▂▁▁▆▁▂▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter        1.21 ms/iter   1.22 ms      █
                        (1.16 ms … 1.36 ms)   1.31 ms      █
                    (234.87 kb … 846.13 kb) 236.59 kb ▁▁▁▁▇█▆▃▃▃▃▃▂▂▂▁▁▂▁▁▁

Alien - toggle filter        774.15 µs/iter 778.92 µs     █
                    (739.75 µs … 942.38 µs) 854.83 µs     █
                    ( 46.05 kb … 552.37 kb) 235.06 kb ▁▁▁▁█▇▃▃▃▂▂▂▂▂▂▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■ 839.13 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.21 ms
       Alien - toggle filter ┤ 774.15 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.08x faster than Preact - toggle filter
   1.56x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       424.00 µs/iter 428.58 µs     █
                    (404.29 µs … 489.33 µs) 469.42 µs     █
                    (504.00  b … 260.49 kb) 773.23  b ▂▁▁▁██▂▅▄▂▂▂▂▂▂▁▁▁▁▁▁

Lattice                      804.42 µs/iter 807.46 µs     █
                    (775.13 µs … 956.04 µs) 873.04 µs    ▅█
                    (456.00  b … 722.99 kb)   2.32 kb ▁▁▁██▇▆▅▃▂▂▂▂▂▂▃▂▂▁▁▁

Alien                        418.68 µs/iter 423.92 µs   ▄█
                    (404.42 µs … 505.21 µs) 462.33 µs   ██  ▂▆
                    (504.00  b … 320.99 kb) 755.01  b ▁▁███▃██▄▂▂▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 424.00 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 804.42 µs
                       Alien ┤ 418.68 µs
                             └                                            ┘

summary
  Alien
   1.01x faster than Preact
   1.92x faster than Lattice
  ✓ Completed in 10.81s

Running: scaling-subscribers

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       16.39 µs/iter  15.42 µs █
                      (14.67 µs … 44.04 µs)  36.17 µs █▄▁▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   2.35 ms)   5.31 kb (456.00  b…106.27 kb)

Preact - 50 subscribers       29.18 µs/iter  28.63 µs  ▂█
                      (26.58 µs … 83.96 µs)  45.50 µs ▄██▂▁▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.36 ms …   2.91 ms)   6.29 kb (456.00  b…242.78 kb)

Preact - 100 subscribers      52.00 µs/iter  51.87 µs               █
                      (49.65 µs … 59.27 µs)  52.45 µs ▆▁▁▁▁▆▁▁▁▆▆▆▁▁█▁▆▁▁▆▆
                  gc(  2.50 ms …   4.03 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     109.90 µs/iter 110.92 µs █ ▇
                    (103.21 µs … 215.38 µs) 169.79 µs ███▅▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   3.15 ms)  11.38 kb (456.00  b…124.95 kb)

Preact - 400 subscribers     312.58 µs/iter 319.00 µs     ▂▇▇█▇▇▅
                    (283.63 µs … 430.58 µs) 357.00 µs ▂▃▃▆███████▆▆▅▅▃▂▁▁▁▁
                  gc(  1.37 ms …   2.89 ms)   4.79 kb (456.00  b… 72.45 kb)

Lattice - 25 subscribers      18.67 µs/iter  17.58 µs █
                      (16.96 µs … 71.42 µs)  39.63 µs █▃▃▁▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   3.26 ms)   4.40 kb (504.00  b…203.27 kb)

Lattice - 50 subscribers      38.20 µs/iter  37.04 µs █
                     (35.25 µs … 192.46 µs)  74.04 µs ██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   7.03 ms)   7.82 kb (152.00  b…412.65 kb)

Lattice - 100 subscribers     73.05 µs/iter  71.67 µs █▄
                     (69.71 µs … 157.96 µs) 110.67 µs ██▂▂▁▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …  29.57 ms)   3.47 kb (504.00  b…104.99 kb)

Lattice - 200 subscribers    146.34 µs/iter 148.83 µs  ▂    ▃▅█
                    (139.42 µs … 176.75 µs) 163.83 µs ██▃▅▇████▅▂▁▁▁▁▂▁▂▁▁▁
                  gc(  1.51 ms …   2.95 ms)  26.43 kb (504.00  b…156.99 kb)

Lattice - 400 subscribers    348.85 µs/iter 355.13 µs     █▆▇▃▃▂▂
                    (327.79 µs … 405.00 µs) 385.00 µs ▂▄▆████████▆▄▄▃▄▂▂▁▂▂
                  gc(  1.41 ms …   2.88 ms)   1.11 kb (456.00  b… 70.16 kb)

Alien - 25 subscribers        14.84 µs/iter  14.25 µs ▃█
                      (12.92 µs … 63.00 µs)  35.58 µs ██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   3.09 ms)   4.73 kb (504.00  b…195.32 kb)

Alien - 50 subscribers        25.38 µs/iter  25.42 µs █  █  █    █  █ ██  █
                      (25.21 µs … 25.68 µs)  25.45 µs █▁▁█▁▁█▁▁▁▁█▁▁█▁██▁▁█
                  gc(  2.24 ms …   5.69 ms)  16.91  b (  0.10  b…208.09  b)

Alien - 100 subscribers       51.37 µs/iter  50.60 µs ▃           █ ▃
                      (49.92 µs … 62.92 µs)  50.87 µs █▆▆▁▁▆▁▁▁▁▁▁█▁█▁▁▁▁▁▆
                  gc(  2.53 ms …   3.77 ms)   0.11  b (  0.10  b…  0.12  b)

Alien - 200 subscribers      113.55 µs/iter 112.54 µs    ▆█
                    (105.96 µs … 282.21 µs) 138.75 µs ▂▃▇██▃▂▁▁▁▁▁▁▂▁▁▁▁▁▁▁
                  gc(  1.53 ms …   3.28 ms)  12.34 kb (504.00  b…124.99 kb)

Alien - 400 subscribers      301.09 µs/iter 307.88 µs     ▂█▅▄
                    (278.21 µs … 387.42 µs) 343.00 µs ▄▅▄███████▇▇▄▃▃▂▂▁▁▂▂
                  gc(  1.44 ms …   2.88 ms)   7.29 kb (504.00  b… 99.99 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 16.39 µs
     Preact - 50 subscribers ┤■ 29.18 µs
    Preact - 100 subscribers ┤■■■■ 52.00 µs
    Preact - 200 subscribers ┤■■■■■■■■■■ 109.90 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 312.58 µs
    Lattice - 25 subscribers ┤ 18.67 µs
    Lattice - 50 subscribers ┤■■ 38.20 µs
   Lattice - 100 subscribers ┤■■■■■■ 73.05 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■■ 146.34 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 348.85 µs
      Alien - 25 subscribers ┤ 14.84 µs
      Alien - 50 subscribers ┤■ 25.38 µs
     Alien - 100 subscribers ┤■■■■ 51.37 µs
     Alien - 200 subscribers ┤■■■■■■■■■■ 113.55 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 301.09 µs
                             └                                            ┘

summary
  Alien - $sources subscribers
   +1.04…+1.1x faster than Preact - $sources subscribers
   +1.16…+1.26x faster than Lattice - $sources subscribers
  ✓ Completed in 32.94s

Running: signal-updates

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          354.84 µs/iter 328.33 µs  █
                    (308.50 µs … 621.67 µs) 571.25 µs  █
                    (408.00  b … 358.23 kb)   1.09 kb ▃█▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▁

Lattice - write only         234.82 µs/iter 405.04 µs █
                     (94.67 µs … 473.29 µs) 456.71 µs █                ▅
                    (120.00  b … 557.40 kb)   1.35 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▂▁▅

Alien - write only            71.57 µs/iter  47.38 µs █
                     (45.88 µs … 602.96 µs) 570.38 µs █
                    ( 32.00  b … 685.40 kb) 470.27  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           233.98 µs/iter 404.71 µs █
                     (92.96 µs … 464.92 µs) 426.42 µs █                  █
                    ( 48.00  b … 544.40 kb)   1.22 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▃

Lattice - read only          214.70 µs/iter 403.71 µs █                  ▅
                     (37.83 µs … 444.08 µs) 416.58 µs █                  █
                    ( 48.00  b … 525.40 kb)   1.04 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▂

Alien - read only             93.14 µs/iter  61.79 µs █
                     (58.04 µs … 646.08 µs) 595.46 µs █
                    ( 48.00  b … 781.40 kb) 465.55  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    381.47 µs/iter 345.92 µs █
                    (325.25 µs … 909.25 µs) 850.58 µs █▃
                    (408.00  b … 309.61 kb)   0.98 kb ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▂

Lattice - read/write mixed   309.84 µs/iter 750.71 µs █
                     (94.67 µs … 860.25 µs) 804.42 µs █
                    ( 48.00  b … 632.90 kb)   1.38 kb █▂▁▁▁▁▇▃▁▁▁▁▁▁▁▁▁▁▂█▂

Alien - read/write mixed     349.75 µs/iter 207.67 µs █
                      (127.67 µs … 1.48 ms)   1.44 ms █
                    (408.00  b … 160.49 kb) 680.60  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 354.84 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 234.82 µs
          Alien - write only ┤ 71.57 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■ 233.98 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 214.70 µs
           Alien - read only ┤■■ 93.14 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 381.47 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.84 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 349.75 µs
                             └                                            ┘

summary
  Alien - write only
   1.3x faster than Alien - read only
   3x faster than Lattice - read only
   3.27x faster than Preact - read only
   3.28x faster than Lattice - write only
   4.33x faster than Lattice - read/write mixed
   4.89x faster than Alien - read/write mixed
   4.96x faster than Preact - write only
   5.33x faster than Preact - read/write mixed
  ✓ Completed in 10.81s

Running: sparse-updates

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   37.52 µs/iter  36.21 µs  █
                     (34.63 µs … 105.63 µs)  67.46 µs ▇█▁▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   3.16 ms)  10.23 kb (456.00  b…317.66 kb)

Preact - 15% sparse updates   47.58 µs/iter  46.17 µs  █
                      (43.67 µs … 96.58 µs)  82.38 µs ██▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.40 ms …   2.53 ms)  12.01 kb (456.00  b…281.55 kb)

Preact - 20% sparse updates   56.62 µs/iter  57.07 µs             █   █
                      (55.15 µs … 57.60 µs)  57.52 µs ██▁▁▁▁█▁▁▁▁▁█▁████▁▁█
                  gc(  2.50 ms …   2.77 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   74.34 µs/iter  75.67 µs  ▅      ▂█
                      (71.54 µs … 89.63 µs)  80.88 µs ▄███▅▅▅▆███▃▂▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.85 ms)   6.12 kb (456.00  b…132.95 kb)

Lattice - 10% sparse updates  45.36 µs/iter  49.83 µs █
                     (39.71 µs … 100.29 µs)  85.79 µs ██▂▁▆▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   3.10 ms)  10.74 kb (504.00  b…910.78 kb)

Lattice - 15% sparse updates  64.83 µs/iter  72.29 µs █▄
                      (59.25 µs … 82.08 µs)  78.38 µs ███▃▁▁▂▂▁▁▁▁▂▄▆▇▄▂▁▁▁
                  gc(  1.31 ms …   2.72 ms)   7.20 kb (504.00  b…124.99 kb)

Lattice - 20% sparse updates  78.41 µs/iter  78.54 µs  ▄█
                      (77.38 µs … 94.04 µs)  85.00 µs ▂███▆▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.52 ms)   8.57 kb (504.00  b…132.99 kb)

Lattice - 25% sparse updates 105.24 µs/iter 112.42 µs ▆█ ▇
                     (97.67 µs … 123.63 µs) 117.42 µs ██▇██▂▁▁▁▁▁▂▃▅▇██▆▅▃▂
                  gc(  1.32 ms …   2.68 ms)  18.58 kb (504.00  b…124.99 kb)

Alien - 10% sparse updates    34.78 µs/iter  38.79 µs  █
                      (29.54 µs … 89.29 µs)  58.92 µs ██▂▃▂▂▄▂▅▃▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   3.33 ms)   8.40 kb (456.00  b…291.29 kb)

Alien - 15% sparse updates    45.36 µs/iter  45.96 µs   █
                      (43.21 µs … 59.46 µs)  55.21 µs ▃▄█▆██▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   2.95 ms)   3.45 kb (456.00  b… 52.95 kb)

Alien - 20% sparse updates    56.38 µs/iter  56.56 µs    █    █
                      (56.05 µs … 56.80 µs)  56.75 µs ██▁█▁▁▁██▁█▁▁▁▁█▁▁█▁█
                  gc(  2.45 ms …   3.08 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    75.49 µs/iter  76.50 µs  █
                      (73.46 µs … 89.88 µs)  80.04 µs ▄█▇▆▆█▇█▇▆█▇▅▂▁▁▁▁▁▁▁
                  gc(  1.41 ms …   2.26 ms)   6.90 kb (456.00  b…124.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■ 37.52 µs
 Preact - 15% sparse updates ┤■■■■■■ 47.58 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■ 56.62 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■ 74.34 µs
Lattice - 10% sparse updates ┤■■■■■ 45.36 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■■■ 64.83 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■ 78.41 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 105.24 µs
  Alien - 10% sparse updates ┤ 34.78 µs
  Alien - 15% sparse updates ┤■■■■■ 45.36 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■ 56.38 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■ 75.49 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   -1.02…+1.08x faster than Preact - $changeRatio% sparse updates
   +1.39…+1.3x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.38s

Running: wide-fanout

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       325.91 µs/iter 316.87 µs  █
                      (296.79 µs … 1.66 ms) 836.83 µs ▆█
                    ( 54.80 kb … 567.09 kb)  56.77 kb ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      350.34 µs/iter 350.58 µs   █
                    (343.25 µs … 483.04 µs) 392.08 µs   █
                    (  4.68 kb … 823.68 kb)  57.49 kb ▁▁█▇▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        299.10 µs/iter 302.96 µs   █
                    (282.50 µs … 511.17 µs) 363.29 µs   █▄▂▄
                    ( 20.22 kb … 564.18 kb)  56.74 kb ▂▂████▄▂▂▂▁▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■ 325.91 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 350.34 µs
                       Alien ┤ 299.10 µs
                             └                                            ┘

summary
  Alien
   1.09x faster than Preact
   1.17x faster than Lattice

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       366.40 µs/iter 366.96 µs        █
                    (354.71 µs … 618.13 µs) 382.04 µs        █
                    (  1.46 kb …   1.53 mb)   8.10 kb ▁▁▁▁▁▁▁█▆█▃▂▂▁▁▁▁▁▁▁▁

Lattice                      266.40 µs/iter 267.79 µs  █▇
                    (258.79 µs … 403.42 µs) 312.08 µs  ██
                    (  5.59 kb … 562.46 kb)   8.68 kb ▁██▆█▄▂▂▂▁▂▁▁▁▁▁▁▁▁▁▁

Alien                        301.90 µs/iter 300.88 µs  █
                    (294.75 µs … 408.08 µs) 344.46 µs  █▃
                    (  5.52 kb …   1.67 mb)   8.83 kb ▁██▄▂▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 366.40 µs
                     Lattice ┤ 266.40 µs
                       Alien ┤■■■■■■■■■■■■ 301.90 µs
                             └                                            ┘

summary
  Lattice
   1.13x faster than Alien
   1.38x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       257.33 µs/iter 257.46 µs     █
                    (247.58 µs … 312.21 µs) 288.25 µs     █▅
                    (  5.57 kb … 647.70 kb)   7.30 kb ▁▂▁███▅▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      150.17 µs/iter 149.29 µs  █
                    (146.42 µs … 320.17 µs) 185.33 µs  █
                    (  5.52 kb … 927.05 kb)   8.59 kb ▁█▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        257.69 µs/iter 257.88 µs █
                    (254.38 µs … 408.96 µs) 289.67 µs █▄▄
                    (  5.52 kb … 927.43 kb)   8.12 kb ███▃▃▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 257.33 µs
                     Lattice ┤ 150.17 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 257.69 µs
                             └                                            ┘

summary
  Lattice
   1.71x faster than Preact
   1.72x faster than Alien
  ✓ Completed in 10.84s

Running: write-heavy

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        55.62 µs/iter  56.33 µs  █
                      (53.96 µs … 90.17 µs)  66.96 µs  █
                    ( 48.00  b … 389.73 kb) 804.37  b ▁█▁▁▆▁▁▁▁▁▁▂▁▁▁▁▁▁▁▁▁

Lattice                      142.52 µs/iter 141.00 µs   █
                    (137.13 µs … 221.17 µs) 164.25 µs   █
                    ( 32.00  b … 835.90 kb)   1.87 kb ▁▁█▂▃▁▂▁▁▁▂▂▁▁▁▁▁▁▁▁▁

Alien                         45.88 µs/iter  44.54 µs █
                     (43.75 µs … 106.42 µs)  84.08 µs █
                    ( 32.00  b … 305.49 kb) 647.90  b █▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

                             ┌                                            ┐
                      Preact ┤■■■ 55.62 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 142.52 µs
                       Alien ┤ 45.88 µs
                             └                                            ┘

summary
  Alien
   1.21x faster than Preact
   3.11x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        32.01 µs/iter  31.13 µs █
                      (30.63 µs … 83.33 µs)  55.58 µs █
                    ( 32.00  b … 227.40 kb) 515.85  b █▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      133.82 µs/iter 132.96 µs   █
                    (130.50 µs … 175.13 µs) 148.63 µs   █
                    ( 48.00  b … 575.49 kb)   2.29 kb ▁▁█▃▂▄▂▁▁▁▁▁▁▁▂▁▁▁▁▁▁

Alien                         40.09 µs/iter  39.08 µs █
                      (38.42 µs … 85.96 µs)  77.83 µs █
                    ( 32.00  b … 259.40 kb) 472.66  b █▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 32.01 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 133.82 µs
                       Alien ┤■■■ 40.09 µs
                             └                                            ┘

summary
  Preact
   1.25x faster than Alien
   4.18x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        92.76 µs/iter  91.88 µs     █
                     (88.88 µs … 242.46 µs) 102.67 µs     █
                    (  1.37 kb … 578.96 kb)   6.75 kb ▁▁▁▁█▂▁▁▃▂▁▁▁▂▁▁▁▁▁▁▁

Lattice                      197.92 µs/iter 208.29 µs ▇         █
                    (175.13 µs … 437.21 µs) 242.92 µs █         █
                    (  5.59 kb … 510.96 kb)   7.24 kb █▅▃▂▂▂▁▁▁▁█▄▂▁▁▁▁▁▇▂▁

Alien                        136.13 µs/iter 135.13 µs █
                    (134.25 µs … 299.04 µs) 148.88 µs █▇
                    (  5.52 kb … 561.96 kb)   6.94 kb ██▂▂▃▃▁▂▁▁▄▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 92.76 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 197.92 µs
                       Alien ┤■■■■■■■■■■■■■■ 136.13 µs
                             └                                            ┘

summary
  Preact
   1.47x faster than Alien
   2.13x faster than Lattice
  ✓ Completed in 10.85s

Summary:
  Total: 14
  Success: 12
  Failed: 0