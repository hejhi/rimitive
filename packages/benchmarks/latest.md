Found 12 benchmark suites

Running: batch-operations

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       546.16 µs/iter 542.50 µs    █
                    (522.38 µs … 683.46 µs) 628.92 µs    █
                    ( 11.04 kb …   1.32 mb) 937.84 kb ▁▁▁█▇▃▂▁▁▁▁▁▁▁▁▁▁▂▁▁▁

Lattice                      717.56 µs/iter 713.29 µs     █
                    (688.46 µs … 854.63 µs) 807.54 µs     █
                    (478.41 kb …   1.36 mb) 937.86 kb ▁▁▁██▄▂▁▁▁▁▁▁▁▁▁▂▁▁▁▁

Alien                        424.43 µs/iter 425.58 µs             █
                    (393.33 µs … 598.00 µs) 442.83 µs             █
                    (456.00  b … 288.99 kb) 964.30  b ▁▁▁▁▁▁▁▁▁▁▁▁██▃▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■ 546.16 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 717.56 µs
                       Alien ┤ 424.43 µs
                             └                                            ┘

summary
  Alien
   1.29x faster than Preact
   1.69x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       131.97 µs/iter 130.29 µs █
                    (128.21 µs … 307.13 µs) 205.83 µs █
                    ( 43.62 kb … 581.16 kb) 204.55 kb ██▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      254.38 µs/iter 253.13 µs   █
                    (242.79 µs … 495.21 µs) 336.88 µs   █
                    ( 19.62 kb …   1.24 mb) 205.86 kb ▁▁█▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        217.04 µs/iter 216.50 µs   █
                    (209.54 µs … 358.42 µs) 288.29 µs  ██
                    (  9.14 kb … 747.47 kb) 149.98 kb ▂██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 131.97 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 254.38 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■ 217.04 µs
                             └                                            ┘

summary
  Preact
   1.64x faster than Alien
   1.93x faster than Lattice

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       409.51 µs/iter 411.63 µs   █
                    (392.54 µs … 573.38 µs) 498.29 µs   █
                    ( 13.15 kb …   1.17 mb) 516.31 kb ▁▁█▅▆▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      545.24 µs/iter 539.75 µs    █
                    (520.25 µs … 715.13 µs) 636.75 µs    █
                    (426.01 kb …   2.39 mb)   1.11 mb ▁▁▅█▃▂▂▂▁▁▁▁▁▁▁▂▂▁▁▁▁

Alien                        432.62 µs/iter 432.29 µs     █
                    (415.29 µs … 593.42 µs) 492.04 µs    ▆█
                    ( 71.17 kb … 693.87 kb) 110.85 kb ▃▂▁██▆▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 409.51 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 545.24 µs
                       Alien ┤■■■■■■ 432.62 µs
                             └                                            ┘

summary
  Preact
   1.06x faster than Alien
   1.33x faster than Lattice
  ✓ Completed in 10.80s

Running: computed-chains

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       398.70 µs/iter 399.21 µs       █
                    (381.17 µs … 442.13 µs) 432.25 µs       █
                    (408.00  b … 288.45 kb) 819.31  b ▁▁▁▁▃▃██▃▂▁▁▁▁▁▁▁▁▁▁▂

Lattice                      525.92 µs/iter 523.46 µs   ▃█
                    (508.50 µs … 670.38 µs) 602.79 µs   ██
                    ( 53.95 kb … 931.12 kb) 625.45 kb ▁▁██▇▂▂▁▁▁▁▁▁▁▁▁▁▁▁▂▁

Alien                        363.47 µs/iter 351.75 µs   █
                    (339.29 µs … 472.92 µs) 458.79 µs  ▂█
                    (408.00  b … 287.49 kb) 971.62  b ▁██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▄▂

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 398.70 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 525.92 µs
                       Alien ┤ 363.47 µs
                             └                                            ┘

summary
  Alien
   1.1x faster than Preact
   1.45x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       223.88 µs/iter 225.13 µs  █
                    (216.67 µs … 452.88 µs) 254.83 µs  █  █
                    (120.00  b … 448.40 kb)   1.46 kb ▄█▆▂█▄▂▃▃▂▂▂▁▂▁▁▁▁▁▁▁

Lattice                      273.07 µs/iter 273.50 µs   █
                    (257.88 µs … 478.54 µs) 358.33 µs   █▇
                    ( 65.42 kb …   1.34 mb) 563.04 kb ▁▄██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        237.43 µs/iter 238.25 µs      █
                    (226.58 µs … 310.71 µs) 262.21 µs      █
                    ( 48.00  b … 467.77 kb)   1.92 kb ▁▂▁▁██▇▆▆▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 223.88 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 273.07 µs
                       Alien ┤■■■■■■■■■ 237.43 µs
                             └                                            ┘

summary
  Preact
   1.06x faster than Alien
   1.22x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       112.44 µs/iter 111.71 µs     █
                    (107.17 µs … 265.87 µs) 129.42 µs    ▄█
                    (120.00  b …   1.52 mb)   1.09 kb ▁▁▁██▂▄▅▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      127.23 µs/iter 126.13 µs  █
                    (120.00 µs … 393.79 µs) 201.33 µs  █
                    ( 32.27 kb … 828.77 kb) 307.21 kb ▂█▆▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        113.25 µs/iter 114.17 µs    █
                    (107.71 µs … 160.63 µs) 135.13 µs    █
                    ( 48.00  b … 314.90 kb)   1.19 kb ▂▁██▄█▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 112.44 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 127.23 µs
                       Alien ┤■■ 113.25 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.13x faster than Lattice
  ✓ Completed in 10.80s

Running: conditional-deps

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       581.63 µs/iter 577.50 µs    █
                    (559.88 µs … 691.13 µs) 662.33 µs    █
                    (785.00 kb …   1.32 mb) 860.90 kb ▁▁▁█▄▂▁▁▁▁▁▁▁▁▁▁▁▁▂▁▁

Lattice                      573.40 µs/iter 571.83 µs ▆██
                    (568.00 µs … 642.50 µs) 608.29 µs ███
                    (504.00  b … 715.49 kb)   1.56 kb ███▅▂▁▁▁▁▄▅▄▁▁▁▁▁▁▁▁▁

Alien                          1.01 ms/iter 562.17 µs █
                     (535.21 µs … 12.90 ms)  11.60 ms █
                    ( 30.38 kb …   1.09 mb) 701.58 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■ 581.63 µs
                     Lattice ┤ 573.40 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.01 ms
                             └                                            ┘

summary
  Lattice
   1.01x faster than Preact
   1.76x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       922.21 µs/iter 924.42 µs    █
                      (878.50 µs … 1.16 ms)   1.06 ms    █▆
                    (370.59 kb …   1.32 mb) 859.40 kb ▂▂▃███▄▃▂▂▂▂▁▂▂▁▁▁▁▁▁

Lattice                        1.25 ms/iter   1.26 ms      █
                        (1.20 ms … 1.39 ms)   1.35 ms      █
                    (504.00  b … 554.49 kb)   1.79 kb ▃▂▁▁▁█▆▄▃▃▆▂▂▂▂▁▁▁▁▁▁

Alien                          1.29 ms/iter 877.50 µs █
                     (831.50 µs … 11.80 ms)  11.65 ms █
                    (297.75 kb …   1.09 mb) 702.64 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 922.21 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.25 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.29 ms
                             └                                            ┘

summary
  Preact
   1.35x faster than Lattice
   1.39x faster than Alien
  ✓ Completed in 8.64s

Running: dense-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   169.67 µs/iter 171.79 µs  ▆█▄▅
                    (160.13 µs … 258.63 µs) 211.63 µs ▅█████▄▃▂▂▁▂▁▂▁▁▁▁▁▁▁
                  gc(  1.48 ms …   4.65 ms)  14.60 kb (456.00  b…  1.36 mb)

Preact - 75% dense updates   238.50 µs/iter 240.79 µs  ▂█
                    (227.75 µs … 353.75 µs) 281.38 µs ▄███▄▄▄▂▂▃▂▁▂▁▁▁▁▁▁▁▁
                  gc(  1.33 ms …   3.99 ms)  14.35 kb (456.00  b…  1.00 mb)

Preact - 90% dense updates   274.75 µs/iter 282.79 µs  █
                    (264.58 µs … 312.42 µs) 304.96 µs ▅█▂▁▂▂▁▃▃▃▃▃▂▂▁▂▁▁▁▁▁
                  gc(  1.36 ms …   3.07 ms)  14.18 kb (456.00  b…136.95 kb)

Preact - 100% dense updates  309.20 µs/iter 314.21 µs  ▃      █▂
                    (295.58 µs … 348.71 µs) 330.00 µs ▇█▄▁▁▂▂▆██▇█▆▅▃▃▁▁▁▁▁
                  gc(  1.38 ms …   2.74 ms)   5.39 kb (456.00  b… 72.45 kb)

Lattice - 50% dense updates  184.29 µs/iter 184.33 µs  ▅▇█
                    (181.13 µs … 266.00 µs) 202.04 µs ████▄▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   4.23 ms) 187.04 kb ( 55.65 kb…  2.30 mb)

Lattice - 75% dense updates  283.83 µs/iter 288.08 µs  ▃    █▅
                    (269.67 µs … 386.25 µs) 314.46 µs ██▃▁▁▅██▇▅▅▃▂▂▁▁▁▂▁▂▂
                  gc(  1.36 ms …   2.85 ms) 160.43 kb ( 47.57 kb…450.84 kb)

Lattice - 90% dense updates  342.42 µs/iter 345.58 µs        █▇
                    (326.46 µs … 385.25 µs) 371.46 µs ▃▆▅▂▄▄▇██▇▅▃▃▂▁▁▂▁▂▁▁
                  gc(  1.40 ms …   2.62 ms) 207.59 kb (157.91 kb…321.80 kb)

Lattice - 100% dense updates 373.46 µs/iter 376.79 µs        ▃█▃
                    (356.75 µs … 411.29 µs) 397.04 µs ▃▆▃▁▁▁▁████▄▄▃▂▁▂▁▁▁▁
                  gc(  1.37 ms …   2.24 ms) 218.95 kb (189.09 kb…398.55 kb)

Alien - 50% dense updates    145.21 µs/iter 143.92 µs  █
                    (142.33 µs … 326.67 µs) 164.96 µs ██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   4.84 ms)  38.93 kb (504.00  b…  1.39 mb)

Alien - 75% dense updates    225.14 µs/iter 227.96 µs  █
                    (216.08 µs … 332.71 µs) 276.63 µs ▄█▄▁▁▂▂▃▂▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   7.90 ms)  25.50 kb (504.00  b…308.27 kb)

Alien - 90% dense updates    266.17 µs/iter 273.83 µs  █
                    (256.79 µs … 330.50 µs) 310.21 µs ▄█▃▂▁▂▃▄▃▂▂▂▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.76 ms)  13.79 kb (504.00  b…138.49 kb)

Alien - 100% dense updates   296.50 µs/iter 303.42 µs ██    ▄ ▂▂
                    (283.13 µs … 344.42 µs) 331.63 µs ██▃▁▂▅█▇██▄▂▁▂▂▂▂▂▁▁▁
                  gc(  1.43 ms …   2.41 ms)  12.10 kb (504.00  b…116.49 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■■■ 169.67 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■■■■ 238.50 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■ 274.75 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■ 309.20 µs
 Lattice - 50% dense updates ┤■■■■■■ 184.29 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 283.83 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 342.42 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 373.46 µs
   Alien - 50% dense updates ┤ 145.21 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■■ 225.14 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■■ 266.17 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 296.50 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.04…+1.17x faster than Preact - $changeRatio% dense updates
   +1.26…+1.27x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.39s

Running: diamond-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       649.92 µs/iter 660.04 µs      █
                    (621.29 µs … 722.25 µs) 701.33 µs     ▄█    ▂
                    (456.00  b … 241.71 kb) 850.58  b ▃▂▁▁███▆▄▄█▄▂▂▂▂▂▂▂▁▁

Lattice                        1.01 ms/iter   1.02 ms    █
                      (955.33 µs … 1.22 ms)   1.14 ms    █
                    (974.30 kb …   2.26 mb)   1.60 mb ▂▁▂█▇▆█▄▃▂▂▃▂▂▂▂▂▁▁▁▁

Alien                        573.99 µs/iter 573.67 µs      █
                    (555.79 µs … 674.58 µs) 613.96 µs     ▃█▂
                    (504.00  b … 316.99 kb) 769.99  b ▂▁▁▁███▅▃▂▂▂▃▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■ 649.92 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.01 ms
                       Alien ┤ 573.99 µs
                             └                                            ┘

summary
  Alien
   1.13x faster than Preact
   1.76x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       333.37 µs/iter 335.42 µs     █
                    (318.83 µs … 494.25 µs) 366.79 µs     █
                    (  4.68 kb … 631.09 kb)  56.59 kb ▁▁▁▁██▃▇▃▂▂▂▂▂▁▁▁▁▁▁▁

Lattice                      235.91 µs/iter 235.88 µs   █
                    (222.92 µs … 452.21 µs) 317.88 µs   █
                    (163.35 kb …   0.98 mb) 260.32 kb ▂▃██▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        292.41 µs/iter 296.13 µs    █▆
                    (282.00 µs … 468.08 µs) 317.38 µs    ██
                    ( 15.63 kb … 525.17 kb)  56.68 kb ▁▁▁██▇▂▂▇█▃▄▂▂▂▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 333.37 µs
                     Lattice ┤ 235.91 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■ 292.41 µs
                             └                                            ┘

summary
  Lattice
   1.24x faster than Alien
   1.41x faster than Preact

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       713.23 µs/iter 713.63 µs  █▄
                    (699.42 µs … 777.21 µs) 768.46 µs  ██▃
                    (504.00  b … 954.28 kb)   1.70 kb ▁███▄▃▃▂▅▂▂▁▂▁▂▂▂▂▂▁▁

Lattice                      874.30 µs/iter 876.50 µs    █
                      (830.50 µs … 1.07 ms)   1.00 ms    █▂
                    (941.30 kb …   3.76 mb)   1.60 mb ▂▂▇██▆▃▃▂▂▂▃▂▂▁▂▁▁▂▁▁

Alien                        620.28 µs/iter 620.25 µs    █
                    (592.96 µs … 807.71 µs) 719.54 µs    █
                    (391.13 kb …   1.14 mb) 393.13 kb ▂▁▂█▆▃▄▂▁▁▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■ 713.23 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 874.30 µs
                       Alien ┤ 620.28 µs
                             └                                            ┘

summary
  Alien
   1.15x faster than Preact
   1.41x faster than Lattice
  ✓ Completed in 10.79s

Running: effect-triggers

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       321.41 µs/iter 323.96 µs       █
                    (278.29 µs … 597.29 µs) 396.17 µs       █▅▃
                    (648.00  b …   2.10 mb) 157.38 kb ▁▁▂▁▁▃███▄▃▃▂▁▁▁▁▁▁▁▁

Lattice                      377.43 µs/iter 381.58 µs        █
                    (328.42 µs … 528.63 µs) 456.08 µs        █
                    (504.00  b … 554.47 kb) 155.02 kb ▁▁▁▁▁▁▂█▇█▂▁▁▁▁▁▁▁▁▁▁

Alien                        268.65 µs/iter 269.79 µs        █
                    (217.00 µs … 463.58 µs) 346.75 µs        █
                    (504.00  b …   1.93 mb) 157.14 kb ▁▁▁▁▁▁▃█▅▂▂▆▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■ 321.41 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 377.43 µs
                       Alien ┤ 268.65 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   1.4x faster than Lattice

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          213.81 µs/iter 214.04 µs    █
                    (202.54 µs … 323.54 µs) 254.04 µs   ▇█
                    (120.00  b … 636.20 kb)   1.79 kb ▂▂██▇▆▃▂▂▂▂▂▂▁▁▁▁▁▁▁▁

Lattice - 10 effects         301.95 µs/iter 305.42 µs       ▂█
                    (287.13 µs … 652.96 µs) 337.04 µs ▅     ██
                    (120.00  b … 581.99 kb)   2.52 kb ██▃▃▂▂███▃▅▃▂▂▁▂▁▁▁▁▁

Alien - 10 effects           223.53 µs/iter 225.83 µs    █
                    (212.42 µs … 304.04 µs) 261.71 µs    █▂
                    (104.00  b … 463.49 kb)   1.38 kb ▄▃▅██▅█▃▂▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤ 213.81 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 301.95 µs
          Alien - 10 effects ┤■■■■ 223.53 µs
                             └                                            ┘

summary
  Preact - 10 effects
   1.05x faster than Alien - 10 effects
   1.41x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         7.59 µs/iter   7.42 µs    █▅
                      (7.00 µs … 172.12 µs)   8.96 µs    ██
                    (728.00  b … 719.77 kb)  20.60 kb ▁▁▂██▆▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                       11.91 µs/iter   8.25 µs  █
                        (7.46 µs … 2.67 ms)  18.38 µs  █
                    (536.00  b … 445.80 kb)  23.81 kb ▄█▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          5.74 µs/iter   5.76 µs █ █
                        (5.70 µs … 5.79 µs)   5.77 µs ███         █ █ █ █ █
                    (764.03  b …   3.53 kb)   2.98 kb ███▁▁█▁███▁▁███████▁█

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■ 7.59 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 11.91 µs
                       Alien ┤ 5.74 µs
                             └                                            ┘

summary
  Alien
   1.32x faster than Preact
   2.08x faster than Lattice
  ✓ Completed in 10.89s

Running: filtered-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        299.00 µs/iter 313.92 µs █
                    (286.33 µs … 365.13 µs) 339.67 µs █
                    (120.00  b … 576.40 kb)   1.54 kb █▇▄▂▂▁▁▁▁▁▅▂▁▁▁▂▃▁▁▄▁

Lattice - 90% filtered       490.43 µs/iter 492.00 µs   █▅
                    (467.29 µs … 690.08 µs) 580.88 µs   ██
                    ( 37.28 kb …   0.99 mb) 625.46 kb ▁▁██▅▇▃▃▂▂▁▁▁▁▁▁▂▂▁▁▁

Alien - 90% filtered         298.90 µs/iter 291.88 µs   █
                    (274.29 µs … 393.88 µs) 377.63 µs   █
                    ( 48.00  b … 512.40 kb)   1.41 kb ▃▄█▅▂▂▁▁▁▁▁▁▁▁▁▁▁▁▅▃▁

                             ┌                                            ┐
       Preact - 90% filtered ┤ 299.00 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 490.43 µs
        Alien - 90% filtered ┤ 298.90 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1x faster than Preact - 90% filtered
   1.64x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       905.98 µs/iter 914.46 µs     █
                      (866.83 µs … 1.08 ms) 995.46 µs     █▂
                    (234.87 kb … 477.50 kb) 235.19 kb ▂▁▁▁██▄▃▄▄▃▂▂▁▂▁▁▁▁▁▁

Lattice - toggle filter        1.11 ms/iter   1.12 ms  ▂█
                        (1.08 ms … 1.28 ms)   1.20 ms  ██
                    (904.51 kb …   2.02 mb)   1.45 mb ▁██▇▄▃▂▆▄▃▃▂▂▃▂▁▁▁▁▂▁

Alien - toggle filter        822.25 µs/iter 820.79 µs     █
                    (788.96 µs … 980.38 µs) 919.04 µs     █
                    (196.15 kb … 541.87 kb) 235.36 kb ▁▁▁▂█▆▃▂▃▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■■■■ 905.98 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.11 ms
       Alien - toggle filter ┤ 822.25 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.1x faster than Preact - toggle filter
   1.35x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       416.07 µs/iter 416.71 µs       █▆
                    (400.79 µs … 486.79 µs) 438.08 µs       ██▇   ▂
                    (408.00  b … 288.49 kb) 870.53  b ▂▁▁▁▂▁███▄▂▂█▄▂▂▁▁▁▁▁

Lattice                      707.22 µs/iter 703.96 µs  █
                    (691.29 µs … 857.25 µs) 792.29 µs  █▆
                    (385.67 kb …   1.89 mb)   1.22 mb ▂██▅▃▂▁▁▁▁▁▁▁▁▁▂▂▂▁▁▁

Alien                        424.85 µs/iter 428.92 µs    █
                    (405.13 µs … 557.38 µs) 475.54 µs    █   █
                    (504.00  b … 320.99 kb) 916.14  b ▁▁▁██▂▃█▂▁▂▃▁▁▁▁▂▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 416.07 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 707.22 µs
                       Alien ┤■ 424.85 µs
                             └                                            ┘

summary
  Preact
   1.02x faster than Alien
   1.7x faster than Lattice
  ✓ Completed in 10.83s

Running: scaling-subscribers

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       17.08 µs/iter  16.04 µs ▅█
                      (14.92 µs … 50.21 µs)  38.75 µs ██▁▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.49 ms …   2.90 ms)   5.51 kb (456.00  b…119.01 kb)

Preact - 50 subscribers       28.31 µs/iter  27.50 µs █▃
                      (26.25 µs … 79.29 µs)  45.50 µs ██▃▁▁▂▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.34 ms …   2.82 ms)   8.66 kb (456.00  b…435.91 kb)

Preact - 100 subscribers      50.65 µs/iter  51.04 µs                     █
                      (49.43 µs … 51.59 µs)  51.15 µs █▁▁▁██▁▁▁▁▁▁█▁█▁█████
                  gc(  2.50 ms …   3.27 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     114.30 µs/iter 114.88 µs   ▂▂▆█▆
                    (103.67 µs … 150.29 µs) 140.08 µs ▃▇█████▃▂▁▂▄▄▃▂▂▂▂▁▁▁
                  gc(  1.49 ms …   3.45 ms)  16.25 kb (456.00  b…156.95 kb)

Preact - 400 subscribers     297.63 µs/iter 302.75 µs       ▃█▇▅▂
                    (273.58 µs … 345.58 µs) 331.38 µs ▂▅▃▃▆▆█████▆▅▄▃▃▂▂▂▂▁
                  gc(  1.41 ms …   3.34 ms)   6.14 kb (456.00  b…116.45 kb)

Lattice - 25 subscribers      19.60 µs/iter  18.04 µs █▇
                     (16.04 µs … 199.42 µs)  51.46 µs ██▄▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.57 ms …   3.29 ms)  22.40 kb (  5.62 kb…848.40 kb)

Lattice - 50 subscribers      35.71 µs/iter  34.63 µs  █
                     (33.50 µs … 180.75 µs)  49.92 µs ██▃▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.55 ms …   3.14 ms)  36.73 kb (120.00  b…607.80 kb)

Lattice - 100 subscribers     74.54 µs/iter  74.13 µs   ▃█
                     (67.83 µs … 105.29 µs) 101.83 µs ▆▄██▃▂▂▃▂▁▂▂▂▂▁▁▁▁▁▁▁
                  gc(  1.56 ms …   2.44 ms)  61.61 kb ( 36.24 kb…160.74 kb)

Lattice - 200 subscribers    144.33 µs/iter 150.50 µs  █▂
                    (134.04 µs … 183.71 µs) 171.96 µs ▃██▆▃▃▂▄▇▇▅▃▃▂▁▂▁▁▁▁▁
                  gc(  1.53 ms …   3.02 ms) 136.36 kb ( 75.99 kb…269.49 kb)

Lattice - 400 subscribers    328.04 µs/iter 333.63 µs     ▅█▃
                    (302.25 µs … 406.92 µs) 378.96 µs ▂▂▂▅███▆▇▇▄▃▂▂▂▁▂▁▂▂▁
                  gc(  1.37 ms …   2.92 ms) 157.51 kb ( 29.88 kb…297.49 kb)
git ad^[[C
Alien - 25 subscribers        15.59 µs/iter  14.96 µs █
                      (13.21 µs … 84.75 µs)  49.42 µs █▆▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.63 ms …   5.76 ms)   4.97 kb (488.00  b… 97.82 kb)

Alien - 50 subscribers        25.97 µs/iter  26.15 µs      █
                      (25.66 µs … 26.23 µs)  26.17 µs █▁▁▁▁█▁▁▁▁█▁▁█▁▁▁█▁██
                  gc(  2.15 ms …   3.92 ms)  17.29  b (  0.10  b…213.13  b)

Alien - 100 subscribers       51.02 µs/iter  51.16 µs       █
                      (50.57 µs … 51.56 µs)  51.31 µs █▁▁▁▁██▁▁█▁█▁██▁█▁▁██
                  gc(  2.57 ms …   5.27 ms)   0.11  b (  0.10  b…  0.12  b)

Alien - 200 subscribers      116.66 µs/iter 118.67 µs     ▃▄█▂
                    (107.67 µs … 136.04 µs) 132.92 µs ▄▇██████▆▂▂▃▃▄▄▆▂▃▄▂▂
                  gc(  1.57 ms …   2.97 ms)  22.76 kb (504.00  b…156.99 kb)

Alien - 400 subscribers      314.42 µs/iter 321.71 µs      ▅█▇▄▃
                    (281.92 µs … 379.29 µs) 362.50 µs ▁▃▃▄██████▇▆▇▆▃▃▁▂▂▂▂
                  gc(  1.44 ms …   2.82 ms)   5.71 kb (504.00  b…116.49 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 17.08 µs
     Preact - 50 subscribers ┤■ 28.31 µs
    Preact - 100 subscribers ┤■■■■ 50.65 µs
    Preact - 200 subscribers ┤■■■■■■■■■■■ 114.30 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 297.63 µs
    Lattice - 25 subscribers ┤ 19.60 µs
    Lattice - 50 subscribers ┤■■ 35.71 µs
   Lattice - 100 subscribers ┤■■■■■■ 74.54 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■■■ 144.33 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 328.04 µs
      Alien - 25 subscribers ┤ 15.59 µs
      Alien - 50 subscribers ┤■ 25.97 µs
     Alien - 100 subscribers ┤■■■■ 51.02 µs
     Alien - 200 subscribers ┤■■■■■■■■■■■ 116.66 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 314.42 µs
                             └                                            ┘

summary
  Preact - $sources subscribers
   +1.06…-1.1x faster than Alien - $sources subscribers
   +1.1…+1.15x faster than Lattice - $sources subscribers
  ✓ Completed in 32.84s

Running: signal-updates

clk: ~3.08 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          355.50 µs/iter 333.29 µs  █
                    (308.17 µs … 613.54 µs) 569.21 µs  █
                    (408.00  b … 344.73 kb)   1.05 kb ▅█▅▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▄▃

Lattice - write only         235.35 µs/iter 405.38 µs █
                     (92.92 µs … 502.96 µs) 465.79 µs █                ▂
                    (120.00  b … 557.40 kb)   1.41 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃█▂▆▂

Alien - write only            81.26 µs/iter  58.25 µs █
                     (44.54 µs … 661.17 µs) 589.79 µs █
                    ( 48.00  b … 653.40 kb) 528.92  b █▃▄▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           234.30 µs/iter 405.92 µs █
                     (92.96 µs … 479.71 µs) 443.71 µs █                 ▇
                    ( 48.00  b … 600.40 kb)   1.08 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂█▄▁

Lattice - read only          215.46 µs/iter 403.79 µs █
                     (37.83 µs … 483.50 µs) 434.25 µs █                 ▇
                    ( 48.00  b … 438.40 kb)   1.12 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██▂

Alien - read only             83.16 µs/iter  60.04 µs █
                     (58.04 µs … 635.38 µs) 584.29 µs █
                    ( 32.00  b … 688.90 kb) 471.73  b █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    380.44 µs/iter 338.25 µs █
                    (325.33 µs … 864.92 µs) 841.92 µs █
                    (408.00  b … 309.61 kb)   0.98 kb █▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃

Lattice - read/write mixed   308.95 µs/iter 752.79 µs █
                     (95.75 µs … 823.50 µs) 794.54 µs █
                    ( 48.00  b … 632.90 kb)   1.40 kb █▁▁▁▁▁▇▂▁▁▁▁▁▁▁▁▁▁▁▇▅

Alien - read/write mixed     349.60 µs/iter 207.71 µs █
                      (126.29 µs … 1.47 ms)   1.45 ms █
                    (408.00  b … 160.49 kb) 680.33  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▃

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 355.50 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 235.35 µs
          Alien - write only ┤ 81.26 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■ 234.30 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■ 215.46 µs
           Alien - read only ┤ 83.16 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 380.44 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 308.95 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 349.60 µs
                             └                                            ┘

summary
  Alien - write only
   1.02x faster than Alien - read only
   2.65x faster than Lattice - read only
   2.88x faster than Preact - read only
   2.9x faster than Lattice - write only
   3.8x faster than Lattice - read/write mixed
   4.3x faster than Alien - read/write mixed
   4.37x faster than Preact - write only
   4.68x faster than Preact - read/write mixed
  ✓ Completed in 10.82s

Running: sparse-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   37.48 µs/iter  36.08 µs  █
                     (34.33 µs … 110.83 µs)  66.42 µs ▇█▂▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.51 ms …   3.42 ms)  10.37 kb (456.00  b…516.09 kb)

Preact - 15% sparse updates   45.62 µs/iter  45.00 µs █▆
                      (43.46 µs … 73.38 µs)  70.04 µs ██▂▁▂▂▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.51 ms …   2.82 ms)   8.85 kb (456.00  b…271.11 kb)

Preact - 20% sparse updates   56.20 µs/iter  56.50 µs ▃            █▃
                      (54.93 µs … 57.63 µs)  57.10 µs █▁▆▁▁▁▁▁▁▁▁▆▁██▁▆▁▁▁▆
                  gc(  2.34 ms …   5.27 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   74.36 µs/iter  75.67 µs ▅▄   ▄▃█▃
                      (71.38 µs … 92.58 µs)  83.54 µs ████▅████▅▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   2.26 ms)   6.56 kb (456.00  b…124.95 kb)

Lattice - 10% sparse updates  38.71 µs/iter  37.42 µs █
                     (36.67 µs … 100.25 µs)  79.92 µs █▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   3.08 ms)  39.86 kb ( 11.24 kb…  1.25 mb)

Lattice - 15% sparse updates  55.66 µs/iter  55.21 µs ▆█
                      (54.42 µs … 93.38 µs)  67.13 µs ██▃▁▁▁▁▁▁▂▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.44 ms …   2.66 ms)  53.73 kb ( 18.87 kb…220.68 kb)

Lattice - 20% sparse updates  82.13 µs/iter  88.42 µs  █            ▂
                     (74.04 µs … 103.96 µs)  92.96 µs ██▄█▅▂▁▁▁▁▁▂▃▄███▇▂▂▁
                  gc(  1.47 ms …   2.96 ms)  75.10 kb ( 42.49 kb…187.49 kb)

Lattice - 25% sparse updates  96.93 µs/iter 101.83 µs  █ ▂▄
                     (90.54 µs … 111.96 µs) 110.46 µs ▆█▅██▇▃▂▂▂▂▂▂▂▃▃▃▃▄▃▂
                  gc(  1.46 ms …   2.90 ms)  98.89 kb ( 78.55 kb…203.12 kb)

Alien - 10% sparse updates    30.67 µs/iter  29.92 µs █
                      (29.29 µs … 68.88 µs)  57.63 µs █▃▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   3.01 ms)   8.09 kb (456.00  b…345.79 kb)

Alien - 15% sparse updates    44.00 µs/iter  44.04 µs  ▅█▅
                      (43.50 µs … 51.13 µs)  47.13 µs ▂███▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   2.41 ms)   5.71 kb (456.00  b… 72.45 kb)

Alien - 20% sparse updates    55.88 µs/iter  55.97 µs   █     █       █
                      (55.42 µs … 56.94 µs)  56.12 µs █▁█▁▁▁▁▁█▁▁▁█▁▁███▁▁█
                  gc(  2.53 ms …   3.97 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    75.47 µs/iter  76.67 µs  ▅      ▃▅▆█
                      (72.21 µs … 88.17 µs)  80.67 µs ▆█▄▅█▇▄▇████▆▂▂▂▁▂▂▂▂
                  gc(  1.45 ms …   2.61 ms)  15.37 kb (456.00  b…132.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■■ 37.48 µs
 Preact - 15% sparse updates ┤■■■■■■■■ 45.62 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■ 56.20 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■ 74.36 µs
Lattice - 10% sparse updates ┤■■■■ 38.71 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■ 55.66 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 82.13 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 96.93 µs
  Alien - 10% sparse updates ┤ 30.67 µs
  Alien - 15% sparse updates ┤■■■■■■■ 44.00 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■■ 55.88 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 75.47 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   -1.01…+1.22x faster than Preact - $changeRatio% sparse updates
   +1.28…+1.26x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.31s

Running: wide-fanout

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       308.50 µs/iter 308.46 µs   █
                    (301.79 µs … 437.67 µs) 333.54 µs   █ █
                    ( 47.59 kb … 471.09 kb)  56.53 kb ▁▁█▆█▃▅▂▂▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      230.08 µs/iter 229.79 µs  ██
                    (217.79 µs … 409.04 µs) 318.63 µs  ██
                    ( 29.85 kb … 810.36 kb) 260.22 kb ▁██▇▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        295.81 µs/iter 294.21 µs   █
                    (286.83 µs … 460.38 µs) 324.58 µs   █▃
                    ( 18.23 kb … 628.18 kb)  56.62 kb ▁▁██▅▂▁▁▁▁▁▁▅▃▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 308.50 µs
                     Lattice ┤ 230.08 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 295.81 µs
                             └                                            ┘

summary
  Lattice
   1.29x faster than Alien
   1.34x faster than Preact

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       364.14 µs/iter 363.75 µs   █
                    (356.75 µs … 621.13 µs) 394.75 µs   █
                    (  5.87 kb …   1.60 mb)   8.15 kb ▁▂█▇█▂▂▁▂▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      177.03 µs/iter 175.83 µs   █
                    (170.00 µs … 347.92 µs) 232.29 µs  ██
                    ( 25.90 kb … 644.27 kb)  28.03 kb ▁██▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        300.70 µs/iter 301.50 µs  █
                    (292.42 µs … 396.83 µs) 354.38 µs  █
                    (  5.52 kb … 549.87 kb)   8.03 kb ▂███▄▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 364.14 µs
                     Lattice ┤ 177.03 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■ 300.70 µs
                             └                                            ┘

summary
  Lattice
   1.7x faster than Alien
   2.06x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       259.35 µs/iter 259.04 µs   █
                    (253.08 µs … 375.87 µs) 290.58 µs   █
                    (  5.59 kb … 547.37 kb)   7.34 kb ▁▁██▃▂▂▄▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                       87.72 µs/iter  86.54 µs  █
                     (85.00 µs … 254.21 µs) 122.04 µs  █
                    (  2.27 kb … 564.77 kb)  40.05 kb ▁█▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        271.76 µs/iter 275.25 µs  █▃
                    (262.13 µs … 339.67 µs) 306.54 µs  ██▂ ▆▇
                    (  5.87 kb …   1.33 mb)   7.90 kb ▁███▄██▇▃▃▂▁▁▁▁▁▂▁▁▁▂

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 259.35 µs
                     Lattice ┤ 87.72 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 271.76 µs
                             └                                            ┘

summary
  Lattice
   2.96x faster than Preact
   3.1x faster than Alien
  ✓ Completed in 10.80s

Running: write-heavy

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        55.07 µs/iter  54.54 µs  █
                      (53.67 µs … 90.63 µs)  65.08 µs  █
                    ( 32.00  b …   1.07 mb)   1.00 kb ▁█▅▁▂▁▂▁▁▁▁▁▁▂▁▁▁▁▁▁▁

Lattice                      142.17 µs/iter 141.25 µs  █
                    (138.21 µs … 307.79 µs) 164.75 µs  █
                    (  1.40 kb … 473.99 kb)  14.28 kb ▂█▇▃▂▂▁▁▁▁▃▁▁▁▁▁▁▁▁▁▁

Alien                         45.79 µs/iter  44.42 µs  █
                     (43.00 µs … 128.71 µs)  83.83 µs  █
                    ( 32.00  b …   1.82 mb) 782.59  b ▁█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 55.07 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 142.17 µs
                       Alien ┤ 45.79 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   3.1x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        48.99 µs/iter  48.33 µs    █
                     (46.79 µs … 172.33 µs)  57.63 µs    █
                    ( 32.00  b … 232.90 kb) 873.57  b ▁▁▂█▁▂▂▁▂▁▁▁▁▁▁▁▂▁▁▁▁

Lattice                      134.07 µs/iter 134.58 µs  █
                    (130.29 µs … 177.17 µs) 151.75 µs  █▃
                    (  1.30 kb … 613.74 kb)   3.25 kb ▁██▁▄▂▂▁▁▁▂▃▁▁▁▂▁▁▁▁▁

Alien                         40.27 µs/iter  39.00 µs █
                      (38.00 µs … 93.58 µs)  77.75 µs █▇
                    ( 32.00  b … 282.90 kb) 561.84  b ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

                             ┌                                            ┐
                      Preact ┤■■■ 48.99 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 134.07 µs
                       Alien ┤ 40.27 µs
                             └                                            ┘

summary
  Alien
   1.22x faster than Preact
   3.33x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        95.03 µs/iter  96.46 µs   █
                     (92.38 µs … 263.04 µs) 107.25 µs   █
                    (  3.96 kb … 588.46 kb)   6.84 kb ▂▃█▂▂▄▆▃▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      188.70 µs/iter 188.54 µs  █
                    (180.58 µs … 326.04 µs) 225.00 µs  █
                    ( 12.49 kb … 568.46 kb)  70.20 kb ▂█▅▂▇▁▁▁▁▁▁▁▁▁▁▁▄▂▁▁▁

Alien                        137.35 µs/iter 138.13 µs    █
                    (132.63 µs … 247.33 µs) 155.83 µs  ▃ █
                    (  5.50 kb … 887.46 kb)   7.06 kb ▁█▃█▂▅▂▂▄▁▂▁▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 95.03 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 188.70 µs
                       Alien ┤■■■■■■■■■■■■■■■ 137.35 µs
                             └                                            ┘

summary
  Preact
   1.45x faster than Alien
   1.99x faster than Lattice
  ✓ Completed in 10.84s

Summary:
  Total: 12
  Success: 12
  Failed: 0