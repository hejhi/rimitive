Found 12 benchmark suites

Running: batch-operations

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       542.07 µs/iter 537.92 µs    █
                    (518.58 µs … 664.58 µs) 625.21 µs    █
                    ( 10.85 kb …   1.32 mb) 937.46 kb ▁▁▁█▄▃▂▂▁▁▁▁▁▁▁▁▂▂▁▁▁

Lattice                      637.15 µs/iter 635.25 µs  █
                    (621.50 µs … 792.83 µs) 725.79 µs  █▅
                    (328.54 kb …   1.34 mb) 937.64 kb ▃██▂▂▆▂▁▁▁▁▁▁▁▁▂▂▁▁▁▁

Alien                        426.32 µs/iter 425.67 µs       █
                    (406.21 µs … 599.00 µs) 461.17 µs       █
                    (440.00  b … 352.99 kb) 942.42  b ▁▂▁▁▁▁██▃▂▂▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■ 542.07 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 637.15 µs
                       Alien ┤ 426.32 µs
                             └                                            ┘

summary
  Alien
   1.27x faster than Preact
   1.49x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       130.86 µs/iter 129.17 µs █
                    (126.79 µs … 359.88 µs) 207.67 µs ██
                    ( 60.75 kb … 851.66 kb) 204.46 kb ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      254.65 µs/iter 253.79 µs  █
                    (247.96 µs … 494.63 µs) 338.33 µs  █
                    ( 45.20 kb …   1.17 mb) 205.53 kb ▁█▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        219.06 µs/iter 219.21 µs  ▃█
                    (209.67 µs … 388.58 µs) 292.92 µs  ██▃
                    ( 14.62 kb … 811.47 kb) 149.88 kb ▁███▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 130.86 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 254.65 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■ 219.06 µs
                             └                                            ┘

summary
  Preact
   1.67x faster than Alien
   1.95x faster than Lattice

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       416.85 µs/iter 414.71 µs  █
                    (404.17 µs … 558.54 µs) 508.21 µs  █▄
                    ( 99.23 kb …   1.17 mb) 517.37 kb ▁██▄▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      551.96 µs/iter 557.83 µs  █
                    (532.54 µs … 791.79 µs) 655.83 µs  █  ▅
                    ( 97.45 kb …   1.34 mb) 516.83 kb ▂█▅▂█▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        479.56 µs/iter 478.42 µs  █
                    (469.75 µs … 648.21 µs) 561.29 µs  █▆
                    (  6.56 kb … 693.89 kb) 110.82 kb ▁██▃▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 416.85 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 551.96 µs
                       Alien ┤■■■■■■■■■■■■■■■■ 479.56 µs
                             └                                            ┘

summary
  Preact
   1.15x faster than Alien
   1.32x faster than Lattice
  ✓ Completed in 10.79s

Running: computed-chains

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       400.09 µs/iter 400.67 µs ▄ █
                    (394.42 µs … 469.04 µs) 436.17 µs █ █
                    (408.00  b … 288.45 kb) 804.66  b █▆██▃▃▄▂▂▁▁▁▂▁▁▁▁▁▁▂▁

Lattice                      453.12 µs/iter 454.21 µs    █
                    (447.96 µs … 510.46 µs) 468.79 µs   ▇█▇ ▂
                    (504.00  b … 323.99 kb)   1.27 kb ▁▁█████▃▄▃▂▂▁▁▁▁▁▁▂▁▁

Alien                        366.19 µs/iter 361.38 µs    █
                    (341.50 µs … 436.46 µs) 428.50 µs    █▆
                    (408.00  b … 371.14 kb) 997.68  b ▁▂▆██▄▃▂▂▂▁▁▁▁▁▁▁▁▁▆▂

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■ 400.09 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 453.12 µs
                       Alien ┤ 366.19 µs
                             └                                            ┘

summary
  Alien
   1.09x faster than Preact
   1.24x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       217.10 µs/iter 218.46 µs   █
                    (210.13 µs … 273.50 µs) 240.42 µs   █  █
                    (120.00  b … 477.90 kb)   1.40 kb ▁▁█▂▄█▇▄▂▂▂▂▁▁▁▁▁▁▁▁▁

Lattice                      224.01 µs/iter 225.25 µs ██
                    (222.08 µs … 286.75 µs) 236.92 µs ██
                    ( 48.00  b … 381.49 kb)   1.83 kb ██▁▁█▇▂▂▂▃▂▁▁▁▁▁▁▁▁▁▁

Alien                        219.59 µs/iter 220.83 µs     █
                    (210.33 µs … 487.63 µs) 248.13 µs    ▇█
                    ( 48.00  b … 445.90 kb)   1.67 kb ▄▁▂██▇▃█▄▂▁▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 217.10 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 224.01 µs
                       Alien ┤■■■■■■■■■■■■ 219.59 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.03x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       116.56 µs/iter 116.42 µs        █
                    (111.67 µs … 193.92 µs) 124.21 µs       ▇██
                    (104.00  b … 391.49 kb) 985.29  b ▁▁▂▁▁▃███▂▃▂▄▂▁▁▁▁▁▁▁

Lattice                      110.58 µs/iter 109.83 µs    █
                    (108.21 µs … 420.63 µs) 117.75 µs    █
                    ( 32.00  b … 689.99 kb)   1.27 kb ▁▁▆█▁▁▂▂▂▂▃▁▁▁▂▁▁▁▁▁▁

Alien                        104.43 µs/iter 103.83 µs   █
                    (102.21 µs … 144.21 µs) 119.13 µs  ▄█
                    ( 32.00  b … 259.40 kb) 803.49  b ▁██▃▁▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 116.56 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■ 110.58 µs
                       Alien ┤ 104.43 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Lattice
   1.12x faster than Preact
  ✓ Completed in 10.80s

Running: conditional-deps

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       588.56 µs/iter 590.00 µs    █
                    (562.71 µs … 707.13 µs) 672.21 µs    █▆
                    (401.26 kb …   1.28 mb) 860.27 kb ▁▁▇██▄▆▃▂▁▁▁▁▁▁▁▂▂▁▁▁

Lattice                      486.82 µs/iter 487.58 µs     █
                    (472.21 µs … 569.88 µs) 538.08 µs     █
                    (504.00  b … 614.49 kb)   1.44 kb ▁▁▂▃██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        990.98 µs/iter 571.71 µs █
                     (537.29 µs … 13.05 ms)  11.41 ms █
                    (118.08 kb …   1.16 mb) 702.00 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 588.56 µs
                     Lattice ┤ 486.82 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 990.98 µs
                             └                                            ┘

summary
  Lattice
   1.21x faster than Preact
   2.04x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       915.72 µs/iter 912.08 µs  █
                      (903.46 µs … 1.08 ms)   1.02 ms  █
                    (632.59 kb …   1.07 mb) 860.04 kb ▆█▆▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                        1.08 ms/iter   1.08 ms        █
                        (1.04 ms … 1.18 ms)   1.13 ms        ██
                    (504.00  b … 440.99 kb)   1.71 kb ▁▁▁▁▁▁▁██▅▄▂▂▂▂▂▁▁▁▁▁

Alien                          1.28 ms/iter 864.00 µs █
                     (845.25 µs … 11.79 ms)  11.66 ms █
                    (257.61 kb …   1.12 mb) 702.17 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 915.72 µs
                     Lattice ┤■■■■■■■■■■■■■■■ 1.08 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.28 ms
                             └                                            ┘

summary
  Preact
   1.18x faster than Lattice
   1.4x faster than Alien
  ✓ Completed in 8.67s

Running: dense-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   163.31 µs/iter 165.17 µs   ▇█▆▃
                    (153.50 µs … 303.33 µs) 187.13 µs ▃▄█████▇▄▃▆▃▂▃▂▂▂▁▁▁▁
                  gc(  1.39 ms …   4.10 ms)  12.00 kb (456.00  b…  1.05 mb)

Preact - 75% dense updates   223.84 µs/iter 223.96 µs    █
                    (217.33 µs … 360.92 µs) 254.33 µs ▃███▆▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   2.25 ms)   9.77 kb (456.00  b…728.40 kb)

Preact - 90% dense updates   269.97 µs/iter 278.29 µs  █
                    (260.46 µs … 313.25 µs) 296.58 µs ▆█▂▁▁▁▁▂▃▄▄▃▂▃▂▁▁▁▁▁▁
                  gc(  1.37 ms …   2.29 ms)   8.05 kb (456.00  b…116.45 kb)

Preact - 100% dense updates  312.23 µs/iter 315.88 µs         ▆█▄
                    (293.00 µs … 357.04 µs) 334.08 µs ▂▃▄▃▂▃▃▅████▇▅▄▃▂▁▁▂▁
                  gc(  1.36 ms …   2.80 ms)   5.82 kb (456.00  b… 72.45 kb)

Lattice - 50% dense updates  167.75 µs/iter 171.13 µs  █
                    (160.17 µs … 342.58 µs) 195.29 µs ▅█▇▅▃▃▅▄▃▃▃▂▁▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   4.11 ms)  35.58 kb (504.00  b…  1.59 mb)

Lattice - 75% dense updates  251.67 µs/iter 258.63 µs ▅ █    ▆ ▂
                    (239.04 µs … 285.58 µs) 282.33 µs ███▇█▂▂█████▂▃▁▁▁▁▂▁▁
                  gc(  1.44 ms …   2.70 ms)  21.35 kb (504.00  b…351.27 kb)

Lattice - 90% dense updates  300.35 µs/iter 306.25 µs █     ▂▆
                    (286.04 µs … 355.46 µs) 336.17 µs ██▂▁▂▂██▇█▄▂▂▂▁▂▁▁▁▁▁
                  gc(  1.41 ms …   2.22 ms)   1.99 kb (504.00  b… 40.49 kb)

Lattice - 100% dense updates 339.18 µs/iter 342.13 µs          █▅▂
                    (321.21 µs … 365.54 µs) 357.00 µs ▂▃▂▁▂▂▃▄█████▆▄▃▂▁▂▁▁
                  gc(  1.38 ms …   2.80 ms) 675.24  b (456.00  b… 13.66 kb)

Alien - 50% dense updates    151.09 µs/iter 155.50 µs  ▄█
                    (143.71 µs … 225.75 µs) 169.88 µs ▂██▆▄▄▄▄▄▄▄▆▄▃▂▁▁▁▁▁▁
                  gc(  1.51 ms …   5.04 ms)  40.58 kb (504.00  b…  1.26 mb)

Alien - 75% dense updates    229.24 µs/iter 234.63 µs  ▂      █▃
                    (215.54 µs … 271.50 µs) 253.71 µs ▆█▇█▆▆▂▃██▆▆▇▃▃▂▂▁▁▂▁
                  gc(  1.49 ms …   2.77 ms)  28.07 kb (504.00  b…351.27 kb)

Alien - 90% dense updates    273.57 µs/iter 278.08 µs  ▄       ██▇
                    (257.54 µs … 293.67 µs) 291.71 µs ▃█▅▄▂▂▃▇██████▅▆▃▂▂▂▂
                  gc(  1.42 ms …   2.80 ms)   5.02 kb (504.00  b…104.99 kb)

Alien - 100% dense updates   297.81 µs/iter 301.42 µs          █
                    (284.00 µs … 331.83 µs) 317.08 µs ▄█▂▁▁▁▁▁▇█▇▅▃▃▂▂▁▁▁▁▁
                  gc(  1.41 ms …   2.73 ms)   4.52 kb (504.00  b… 72.49 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■ 163.31 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■■■ 223.84 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 269.97 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 312.23 µs
 Lattice - 50% dense updates ┤■■■ 167.75 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■ 251.67 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■ 300.35 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 339.18 µs
   Alien - 50% dense updates ┤ 151.09 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■■■■ 229.24 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■ 273.57 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■ 297.81 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.05…+1.08x faster than Preact - $changeRatio% dense updates
   +1.14…+1.11x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.40s

Running: diamond-deps

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       644.09 µs/iter 645.13 µs   █
                    (635.08 µs … 706.42 µs) 674.50 µs  ▇█▆▅
                    (456.00  b … 241.71 kb) 785.86  b ▁████▇▃▃▂▂▂▅▆▂▂▁▁▁▁▁▁

Lattice                      832.83 µs/iter 829.29 µs ▄█
                    (823.83 µs … 966.54 µs) 928.50 µs ██
                    (321.38 kb … 767.14 kb) 391.67 kb ██▃▂▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        595.43 µs/iter 595.38 µs   █
                    (588.63 µs … 693.83 µs) 621.25 µs   █ ▆
                    (504.00  b … 316.99 kb) 779.88  b ▁▁█▄█▃▃▁▁▁▁▂▁▁▁▁▂▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 644.09 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 832.83 µs
                       Alien ┤ 595.43 µs
                             └                                            ┘

summary
  Alien
   1.08x faster than Preact
   1.4x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       309.16 µs/iter 309.46 µs      █ ▃
                    (298.08 µs … 491.00 µs) 329.17 µs      █ █
                    ( 15.09 kb … 537.63 kb)  56.57 kb ▁▁▁▂▁███▅▃▂▁▂▂▂▁▁▁▁▁▁

Lattice                      175.12 µs/iter 176.00 µs    █
                    (170.25 µs … 624.67 µs) 189.96 µs █▄ █     ▅
                    ( 15.50 kb … 894.33 kb) 134.56 kb ██▁█▆▇▆▂▂█▂▂▁▁▁▁▁▁▁▁▁

Alien                        291.74 µs/iter 293.79 µs    █
                    (279.38 µs … 501.96 µs) 331.58 µs    █
                    ( 15.63 kb … 599.09 kb)  56.64 kb ▁▁▁██▃▂▆▃▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.16 µs
                     Lattice ┤ 175.12 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 291.74 µs
                             └                                            ┘

summary
  Lattice
   1.67x faster than Alien
   1.77x faster than Preact

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       736.31 µs/iter 736.33 µs        █
                    (712.58 µs … 805.62 µs) 771.08 µs        ██
                    (488.00  b … 870.78 kb)   1.58 kb ▁▁▁▁▁▁▄██▃▂▂▁▂▁▁▁▁▁▁▁

Lattice                      756.43 µs/iter 754.13 µs  █
                    (743.75 µs … 904.58 µs) 853.67 µs  █▇
                    (352.43 kb …   0.98 mb) 392.24 kb ▁██▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        615.72 µs/iter 616.33 µs  █
                    (602.33 µs … 784.88 µs) 713.50 µs  █
                    ( 27.15 kb …   1.22 mb) 392.37 kb ▁█▄▃▄▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 736.31 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 756.43 µs
                       Alien ┤ 615.72 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   1.23x faster than Lattice
  ✓ Completed in 10.82s

Running: effect-triggers

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       319.55 µs/iter 323.13 µs       █
                    (280.42 µs … 610.33 µs) 400.58 µs       █▃
                    (648.00  b …   2.05 mb) 157.25 kb ▁▁▁▁▁▁██▃▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      280.70 µs/iter 301.83 µs  █
                    (260.63 µs … 496.54 µs) 361.88 µs  █
                    (504.00  b …   1.05 mb) 156.50 kb ▁█▂▁▁▁▁▁▅▃▆▂▁▁▁▁▁▁▁▁▁

Alien                        265.86 µs/iter 263.58 µs        █
                    (220.71 µs … 460.79 µs) 337.29 µs        █
                    (504.00  b …   1.85 mb) 157.12 kb ▁▁▁▁▁▁▂█▃▁▁▄▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 319.55 µs
                     Lattice ┤■■■■■■■■■ 280.70 µs
                       Alien ┤ 265.86 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Lattice
   1.2x faster than Preact

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          226.79 µs/iter 241.96 µs █
                    (210.88 µs … 360.75 µs) 260.67 µs █
                    (120.00  b … 664.02 kb)   1.78 kb █▅▃▂▁▁▁▁▁▁▁▆█▇▄▃▃▁▁▁▁

Lattice - 10 effects         242.28 µs/iter 242.29 µs    █
                    (238.63 µs … 308.63 µs) 261.79 µs ▆ ▆█
                    (120.00  b … 477.90 kb)   1.67 kb █▆██▄▃▄▂▂▁▂▁▁▁▁▁▁▁▁▁▁

Alien - 10 effects           221.46 µs/iter 222.63 µs      █
                    (211.92 µs … 318.08 µs) 241.13 µs      █▃
                    (120.00  b … 387.40 kb)   1.29 kb ▁▁▁▁▆██▆▇▃▃▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤■■■■■■■■■ 226.79 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 242.28 µs
          Alien - 10 effects ┤ 221.46 µs
                             └                                            ┘

summary
  Alien - 10 effects
   1.02x faster than Preact - 10 effects
   1.09x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         7.56 µs/iter   7.46 µs     █
                      (7.04 µs … 179.92 µs)   8.46 µs     █▃
                    (312.00  b … 643.25 kb)  20.63 kb ▁▁▄███▇▄▅▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                       10.81 µs/iter   7.04 µs  █
                        (6.29 µs … 2.73 ms)  16.33 µs  █
                    (792.00  b … 415.85 kb)  23.73 kb ▂█▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          5.75 µs/iter   5.82 µs ▂    █       ▂
                        (5.65 µs … 5.93 µs)   5.92 µs █ ▅▅ █▅▅     █      ▅
                    (712.94  b …   3.53 kb)   2.97 kb █▁██▇███▇▇▁▁▁█▇▁▁▇▁▁█

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■ 7.56 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 10.81 µs
                       Alien ┤ 5.75 µs
                             └                                            ┘

summary
  Alien
   1.31x faster than Preact
   1.88x faster than Lattice
  ✓ Completed in 10.88s

Running: filtered-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        298.29 µs/iter 314.13 µs  █
                    (282.71 µs … 587.58 µs) 347.25 µs  █
                    (120.00  b … 445.90 kb)   1.64 kb ▁█▆▃▂▁▁▁▁▁▄▂▂▃▃▁▁▂▁▁▁

Lattice - 90% filtered       382.74 µs/iter 381.33 µs   █
                    (374.33 µs … 462.71 µs) 415.25 µs   █
                    (408.00  b … 307.49 kb)   1.14 kb ▁▄██▂▂▂▂▂▁▁▁▁▁▁▁▁▁▃▂▁

Alien - 90% filtered         297.45 µs/iter 292.38 µs   █
                    (273.71 µs … 388.58 µs) 371.71 µs   █
                    ( 48.00  b … 480.40 kb)   1.45 kb ▁▂█▂█▁▁▁▁▁▁▁▁▁▁▁▁▆▁▂▁

                             ┌                                            ┐
       Preact - 90% filtered ┤ 298.29 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 382.74 µs
        Alien - 90% filtered ┤ 297.45 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1x faster than Preact - 90% filtered
   1.29x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       891.14 µs/iter 864.79 µs  █
                      (809.79 µs … 2.76 ms)   2.34 ms ▂█
                    ( 14.65 kb … 238.61 kb) 234.59 kb ██▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter        1.07 ms/iter 974.21 µs █
                      (927.92 µs … 4.83 ms)   3.01 ms █
                    (164.78 kb … 797.37 kb) 235.62 kb █▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien - toggle filter        832.27 µs/iter 789.92 µs █
                      (747.13 µs … 2.83 ms)   2.39 ms █
                    (158.14 kb … 541.87 kb) 235.15 kb ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■■■ 891.14 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.07 ms
       Alien - toggle filter ┤ 832.27 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.07x faster than Preact - toggle filter
   1.28x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       443.37 µs/iter 441.67 µs  █
                      (412.00 µs … 2.37 ms) 977.83 µs ▂█
                    (504.00  b … 145.49 kb) 712.14  b ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      556.81 µs/iter 561.29 µs   █
                      (538.50 µs … 2.17 ms) 617.46 µs   █   ▅
                    (456.00  b … 228.49 kb)   1.00 kb ▂██▆▂▆█▃▂▂▂▁▂▁▁▁▁▁▁▁▁

Alien                        417.19 µs/iter 422.71 µs   █
                    (408.25 µs … 510.71 µs) 446.50 µs   █
                    (504.00  b … 217.02 kb) 762.00  b ▁▂█▆▃▂▁▂▅▄▂▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■ 443.37 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 556.81 µs
                       Alien ┤ 417.19 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Preact
   1.33x faster than Lattice
  ✓ Completed in 10.84s

Running: scaling-subscribers

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       16.85 µs/iter  15.92 µs █
                      (14.79 µs … 50.83 µs)  43.13 µs █▃▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.51 ms …   2.32 ms)   6.12 kb (456.00  b…119.01 kb)

Preact - 50 subscribers       29.10 µs/iter  28.58 µs   █
                      (26.50 µs … 72.63 µs)  45.83 µs ▃▅█▂▁▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.86 ms)   8.47 kb (456.00  b…275.29 kb)

Preact - 100 subscribers      50.43 µs/iter  50.77 µs                █▃ ▃
                      (48.80 µs … 51.20 µs)  51.01 µs ▆▁▁▁▁▁▁▁▁▁▁▆▆▁▁██▁█▁▆
                  gc(  2.38 ms …   3.88 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     107.50 µs/iter 110.38 µs ▅█▅       ▂▂▆▄
                    (102.42 µs … 125.17 µs) 115.75 µs ███▃▄▅█▅▇█████▆▃▂▂▃▂▁
                  gc(  1.51 ms …   2.95 ms)  24.62 kb (456.00  b…124.95 kb)

Preact - 400 subscribers     301.11 µs/iter 306.46 µs      ▂█
                    (283.50 µs … 332.42 µs) 326.21 µs ▂▁▄▃▄████▇▄▅▅▄▄▃▂▂▁▂▁
                  gc(  1.41 ms …   2.25 ms)   3.76 kb (456.00  b… 72.45 kb)

Lattice - 25 subscribers      16.17 µs/iter  15.08 µs ▂█
                      (13.96 µs … 52.71 µs)  35.21 µs ██▃▂▁▁▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁
                  gc(  1.55 ms …   5.12 ms)   5.51 kb (504.00  b…251.27 kb)

Lattice - 50 subscribers      27.86 µs/iter  28.00 µs  █
                      (27.64 µs … 28.18 µs)  28.07 µs ███▁█▁█▁▁▁█▁▁▁▁▁██▁██
                  gc(  2.04 ms …   3.76 ms)  39.97  b (  0.10  b…478.47  b)

Lattice - 100 subscribers     56.07 µs/iter  56.16 µs        █      █
                      (55.52 µs … 56.51 µs)  56.43 µs █▁▁▁▁▁██▁▁█▁███▁▁▁█▁█
                  gc(  2.49 ms …   3.12 ms)   0.11  b (  0.10  b…  0.12  b)

Lattice - 200 subscribers    125.81 µs/iter 125.58 µs   ▅▄█▇
                    (116.13 µs … 150.92 µs) 148.38 µs ▂█████▅▂▁▁▁▁▂▃▃▃▄▃▃▂▂
                  gc(  1.50 ms …   2.77 ms)  24.62 kb (504.00  b…156.99 kb)

Lattice - 400 subscribers    304.21 µs/iter 311.13 µs      █▃
                    (282.29 µs … 351.17 µs) 338.25 µs ▂▂▂▄▇███▆▆██▄▃▃▂▂▁▂▁▁
                  gc(  1.44 ms …   2.88 ms)   6.97 kb (504.00  b…116.49 kb)

Alien - 25 subscribers        14.14 µs/iter  13.67 µs █▃
                      (12.67 µs … 41.92 µs)  29.00 µs ██▄▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.57 ms …   2.88 ms)   5.19 kb (504.00  b… 97.82 kb)

Alien - 50 subscribers        25.19 µs/iter  25.20 µs         █ █
                      (24.98 µs … 25.39 µs)  25.37 µs █▁▁▁▁▁▁▁█████▁▁▁▁▁▁▁█
                  gc(  2.18 ms …   3.34 ms)  19.31  b (  0.10  b…258.59  b)

Alien - 100 subscribers       50.02 µs/iter  50.23 µs                   █
                      (49.64 µs … 50.48 µs)  50.30 µs ▆▆▁▆▁▁▆▁▆▁▆▁▁▆▁▁▁▁█▁▆
                  gc(  2.58 ms …   3.24 ms)   0.11  b (  0.10  b…  0.12  b)

Alien - 200 subscribers      113.19 µs/iter 115.79 µs     ▄▇█▄▄▂
                    (104.58 µs … 134.63 µs) 131.96 µs ██▆███████▄▂▂▂▄▂▂▃▂▂▂
                  gc(  1.43 ms …   3.00 ms)  19.62 kb (456.00  b…124.99 kb)

Alien - 400 subscribers      306.87 µs/iter 314.67 µs        █     ▂
                    (278.75 µs … 357.92 µs) 331.79 µs ▂▁▃▂▃▃▇██▄▆▆██▆▇▅▄▃▃▁
                  gc(  1.41 ms …   3.04 ms)   5.12 kb (456.00  b…116.45 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 16.85 µs
     Preact - 50 subscribers ┤■■ 29.10 µs
    Preact - 100 subscribers ┤■■■■ 50.43 µs
    Preact - 200 subscribers ┤■■■■■■■■■■■ 107.50 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 301.11 µs
    Lattice - 25 subscribers ┤ 16.17 µs
    Lattice - 50 subscribers ┤■■ 27.86 µs
   Lattice - 100 subscribers ┤■■■■■ 56.07 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■■ 125.81 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 304.21 µs
      Alien - 25 subscribers ┤ 14.14 µs
      Alien - 50 subscribers ┤■ 25.19 µs
     Alien - 100 subscribers ┤■■■■ 50.02 µs
     Alien - 200 subscribers ┤■■■■■■■■■■■■ 113.19 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 306.87 µs
                             └                                            ┘

summary
  Preact - $sources subscribers
   +1.02…-1.19x faster than Alien - $sources subscribers
   +1.01…-1.04x faster than Lattice - $sources subscribers
  ✓ Completed in 36.84s

Running: signal-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          353.20 µs/iter 320.71 µs █
                    (314.25 µs … 594.29 µs) 566.58 µs █
                    (408.00  b … 358.23 kb)   1.06 kb █▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃▃

Lattice - write only         235.94 µs/iter 411.58 µs █
                     (95.75 µs … 485.25 µs) 452.83 µs █                 ▄
                    (120.00  b … 512.40 kb)   1.37 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▂▆

Alien - write only            71.46 µs/iter  47.46 µs █
                     (45.88 µs … 598.08 µs) 565.63 µs █
                    ( 48.00  b … 717.40 kb) 472.39  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           234.19 µs/iter 404.21 µs █
                     (95.75 µs … 438.75 µs) 423.92 µs █                  ▆
                    ( 48.00  b … 573.90 kb)   1.25 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▆

Lattice - read only          214.98 µs/iter 403.92 µs █                  ▄
                     (38.54 µs … 451.08 µs) 417.50 µs █                  █
                    ( 48.00  b … 576.40 kb)   1.15 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▃

Alien - read only             91.43 µs/iter  60.04 µs █
                     (58.13 µs … 612.79 µs) 574.38 µs █
                    ( 48.00  b … 781.40 kb) 511.74  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    380.04 µs/iter 338.17 µs █
                    (334.83 µs … 850.04 µs) 844.04 µs █
                    (408.00  b … 309.61 kb)   0.98 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▁

Lattice - read/write mixed   309.42 µs/iter 752.46 µs █
                     (94.71 µs … 825.88 µs) 794.13 µs █
                    ( 48.00  b … 632.90 kb)   1.34 kb █▁▁▁▁▁▆▄▁▁▁▁▁▁▁▁▁▁▁▇▅

Alien - read/write mixed     350.01 µs/iter 214.17 µs █
                      (127.67 µs … 1.49 ms)   1.46 ms █
                    (408.00  b … 128.49 kb) 680.58  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 353.20 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 235.94 µs
          Alien - write only ┤ 71.46 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■ 234.19 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 214.98 µs
           Alien - read only ┤■■ 91.43 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 380.04 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.42 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 350.01 µs
                             └                                            ┘

summary
  Alien - write only
   1.28x faster than Alien - read only
   3.01x faster than Lattice - read only
   3.28x faster than Preact - read only
   3.3x faster than Lattice - write only
   4.33x faster than Lattice - read/write mixed
   4.9x faster than Alien - read/write mixed
   4.94x faster than Preact - write only
   5.32x faster than Preact - read/write mixed
  ✓ Completed in 10.81s

Running: sparse-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   37.77 µs/iter  36.38 µs ▂█
                     (34.75 µs … 117.92 µs)  77.04 µs ██▁▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   3.16 ms)  10.30 kb (456.00  b…508.72 kb)

Preact - 15% sparse updates   46.53 µs/iter  45.21 µs █
                      (44.42 µs … 82.96 µs)  70.50 µs █▅▁▁▂▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   2.90 ms)   6.17 kb (456.00  b…322.27 kb)

Preact - 20% sparse updates   56.47 µs/iter  56.96 µs             ██      █
                      (55.44 µs … 57.14 µs)  57.04 µs █▁▁▁██▁▁▁▁▁▁██▁▁█▁▁██
                  gc(  2.45 ms …   5.68 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   74.74 µs/iter  75.75 µs  ▃▂    ▃█
                      (71.67 µs … 86.67 µs)  81.58 µs ▃██▅▄▆▅██▇▃▃▂▂▂▁▂▂▁▁▁
                  gc(  1.40 ms …   2.29 ms)  12.52 kb (456.00  b…132.95 kb)

Lattice - 10% sparse updates  34.60 µs/iter  33.29 µs █
                     (32.29 µs … 120.50 µs)  71.58 µs █▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   3.62 ms)  10.85 kb (504.00  b…986.23 kb)

Lattice - 15% sparse updates  49.24 µs/iter  49.13 µs  ▂█▇
                      (48.04 µs … 61.38 µs)  54.96 µs ▂███▄▂▁▁▁▁▁▁▁▁▁▁▁▂▂▂▁
                  gc(  1.44 ms …   2.85 ms)   9.46 kb (504.00  b…206.59 kb)

Lattice - 20% sparse updates  65.23 µs/iter  65.08 µs  █
                      (63.92 µs … 85.08 µs)  81.71 µs ▄█▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   2.81 ms)   8.01 kb (504.00  b…132.99 kb)

Lattice - 25% sparse updates  80.61 µs/iter  80.54 µs  █▃
                      (79.38 µs … 98.54 µs)  91.46 µs ▄██▂▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.40 ms …   2.86 ms)  11.33 kb (504.00  b…132.99 kb)

Alien - 10% sparse updates    30.65 µs/iter  29.92 µs █
                      (29.25 µs … 84.96 µs)  58.79 µs █▃▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   3.37 ms)   8.55 kb (456.00  b…256.66 kb)

Alien - 15% sparse updates    44.73 µs/iter  44.71 µs  █
                      (43.50 µs … 64.04 µs)  54.75 µs ▆█▇▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.40 ms …   2.97 ms)   5.72 kb (456.00  b… 52.95 kb)

Alien - 20% sparse updates    55.78 µs/iter  55.79 µs █  █    █
                      (55.60 µs … 56.22 µs)  56.08 µs ████▁▁█▁█▁▁▁▁▁▁█▁▁▁▁█
                  gc(  2.40 ms …   3.36 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    76.84 µs/iter  78.00 µs      ▂▅█▅▃
                      (72.58 µs … 94.71 µs)  85.63 µs ▄█▆▇██████▅▄▃▂▁▂▂▂▁▁▁
                  gc(  1.44 ms …   2.77 ms)  10.69 kb (456.00  b…132.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■■■■ 37.77 µs
 Preact - 15% sparse updates ┤■■■■■■■■■■■ 46.53 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■ 56.47 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 74.74 µs
Lattice - 10% sparse updates ┤■■■ 34.60 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■ 49.24 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■ 65.23 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 80.61 µs
  Alien - 10% sparse updates ┤ 30.65 µs
  Alien - 15% sparse updates ┤■■■■■■■■■■ 44.73 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■■■■■■ 55.78 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 76.84 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   -1.03…+1.23x faster than Preact - $changeRatio% sparse updates
   +1.05…+1.13x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.31s

Running: wide-fanout

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       308.42 µs/iter 308.83 µs    █ ▄
                    (302.54 µs … 447.92 µs) 328.21 µs   ██ █
                    ( 54.80 kb … 473.59 kb)  56.57 kb ▂▁██▅█▄▅▂▂▂▂▁▂▁▁▁▁▁▁▁

Lattice                      170.85 µs/iter 169.92 µs  █
                    (164.54 µs … 330.29 µs) 226.42 µs  █
                    ( 16.80 kb …   1.05 mb) 134.79 kb ▁██▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        296.15 µs/iter 298.13 µs   ▄█
                    (285.96 µs … 470.29 µs) 332.21 µs   ██
                    ( 15.09 kb … 532.18 kb)  56.59 kb ▁▄██▇▃▂█▃▂▂▂▂▂▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 308.42 µs
                     Lattice ┤ 170.85 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 296.15 µs
                             └                                            ┘

summary
  Lattice
   1.73x faster than Alien
   1.81x faster than Preact

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       363.90 µs/iter 364.25 µs    █
                    (355.42 µs … 609.33 µs) 389.67 µs    █
                    (  5.87 kb …   1.55 mb)   7.91 kb ▂▁▅██▄▃▂▁▇▂▂▁▁▁▁▁▁▁▁▁

Lattice                      121.51 µs/iter 120.50 µs  █
                    (117.96 µs … 280.17 µs) 150.67 µs  █▄
                    (  3.77 kb … 608.27 kb)  15.23 kb ▁██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        299.36 µs/iter 299.63 µs  █
                    (291.13 µs … 415.17 µs) 349.38 µs  █▆
                    (  5.52 kb … 549.87 kb)   7.97 kb ▃██▄▄▅▂▁▁▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 363.90 µs
                     Lattice ┤ 121.51 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■ 299.36 µs
                             └                                            ┘

summary
  Lattice
   2.46x faster than Alien
   2.99x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       259.43 µs/iter 259.08 µs   █
                    (252.29 µs … 525.46 µs) 288.92 µs   █
                    (  5.59 kb … 547.37 kb)   7.24 kb ▂▂██▃▂▃▄▂▁▁▁▁▁▂▁▁▁▁▁▁

Lattice                       56.02 µs/iter  54.46 µs █
                       (52.00 µs … 1.23 ms) 147.83 µs █▅
                    (  3.27 kb … 495.91 kb)  14.52 kb ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        307.67 µs/iter 282.21 µs █
                      (263.00 µs … 1.81 ms) 987.67 µs █
                    (  2.96 kb … 515.37 kb)   8.03 kb █▇▁▁▁▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■ 259.43 µs
                     Lattice ┤ 56.02 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 307.67 µs
                             └                                            ┘

summary
  Lattice
   4.63x faster than Preact
   5.49x faster than Alien
  ✓ Completed in 10.83s

Running: write-heavy

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        57.32 µs/iter  57.21 µs   █
                      (54.71 µs … 93.08 µs)  71.63 µs  ▂█▃
                    ( 48.00  b …   1.24 mb)   1.03 kb ▁███▅▄▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      133.61 µs/iter 135.63 µs  ▂█
                    (129.88 µs … 230.96 µs) 152.13 µs  ██
                    ( 48.00  b … 511.99 kb)   1.76 kb ▃██▃▄█▆▂▁▂▁▁▁▁▁▁▁▁▁▁▁

Alien                         46.05 µs/iter  44.46 µs █
                     (43.71 µs … 119.13 µs)  87.88 µs █
                    ( 32.00  b … 282.49 kb) 669.16  b █▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■ 57.32 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 133.61 µs
                       Alien ┤ 46.05 µs
                             └                                            ┘

summary
  Alien
   1.24x faster than Preact
   2.9x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        49.23 µs/iter  48.96 µs  █
                      (47.63 µs … 82.33 µs)  62.29 µs  █
                    ( 32.00  b … 376.99 kb) 872.00  b ▃█▄▃▂▂▁▁▁▁▁▂▁▁▁▁▁▁▁▁▁

Lattice                      126.57 µs/iter 127.54 µs   █
                    (123.25 µs … 173.29 µs) 143.46 µs   █
                    ( 48.00  b … 580.49 kb)   1.91 kb ▃██▂▅▃▄▂▃▁▂▁▁▁▁▁▁▁▁▁▁

Alien                         40.24 µs/iter  39.04 µs █
                     (38.42 µs … 110.21 µs)  80.58 µs █
                    ( 32.00  b … 502.49 kb) 508.20  b █▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■ 49.23 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 126.57 µs
                       Alien ┤ 40.24 µs
                             └                                            ┘

summary
  Alien
   1.22x faster than Preact
   3.15x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        95.09 µs/iter  96.29 µs  █
                     (92.17 µs … 290.33 µs) 116.38 µs  █
                    (  2.37 kb … 647.81 kb)   6.88 kb ▄█▂▅▆▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      177.27 µs/iter 178.58 µs  █▅ ▂
                    (170.08 µs … 376.29 µs) 208.25 µs  ██ █
                    (  5.50 kb … 790.46 kb)   7.90 kb ▆████▅▂▂▆▂▂▃▂▂▂▁▁▁▁▁▁

Alien                        137.61 µs/iter 138.67 µs  █
                    (133.00 µs … 282.38 µs) 162.21 µs  █▄
                    (  5.52 kb … 681.07 kb)   7.03 kb ▅██▄▆▃▄▁▂▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 95.09 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 177.27 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■ 137.61 µs
                             └                                            ┘

summary
  Preact
   1.45x faster than Alien
   1.86x faster than Lattice
  ✓ Completed in 10.85s

Summary:
  Total: 12
  Success: 12
  Failed: 0