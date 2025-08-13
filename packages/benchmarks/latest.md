Running: batch-operations

clk: ~2.85 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       546.67 µs/iter 546.00 µs   █▆
                    (521.79 µs … 693.75 µs) 649.46 µs   ██▂
                    ( 10.85 kb …   1.32 mb) 937.43 kb ▁▂███▅▂▂▁▁▁▁▁▁▂▂▂▁▁▁▁

Lattice                      506.03 µs/iter 508.83 µs   █
                    (481.04 µs … 643.21 µs) 607.29 µs   ██
                    (602.13 kb …   1.23 mb) 938.28 kb ▁▂██▇█▃▂▁▁▁▁▁▂▁▂▁▁▁▁▁

Alien                        428.91 µs/iter 430.21 µs       █
                    (406.04 µs … 582.67 µs) 463.54 µs       █▇
                    (456.00  b … 352.99 kb)   1.07 kb ▁▁▁▁▁▂██▇▅▄▄▂▂▂▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 546.67 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■ 506.03 µs
                       Alien ┤ 428.91 µs
                             └                                            ┘

summary
  Alien
   1.18x faster than Lattice
   1.27x faster than Preact

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       131.40 µs/iter 130.92 µs ▄█
                    (126.33 µs … 325.54 µs) 209.00 µs ██
                    ( 10.70 kb … 678.20 kb) 204.35 kb ██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      183.23 µs/iter 183.00 µs        █
                    (136.25 µs … 391.88 µs) 258.33 µs        █▂
                    ( 38.84 kb … 738.67 kb) 204.88 kb ▁▁▁▁▁▁▁██▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        217.85 µs/iter 218.08 µs  █
                    (210.42 µs … 364.71 µs) 290.21 µs  █
                    ( 44.88 kb … 747.48 kb) 149.97 kb ▂██▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 131.40 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■ 183.23 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 217.85 µs
                             └                                            ┘

summary
  Preact
   1.39x faster than Lattice
   1.66x faster than Alien

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       412.51 µs/iter 412.42 µs  █
                    (398.13 µs … 675.75 µs) 519.50 µs  █
                    (125.82 kb … 981.28 kb) 517.24 kb ▂██▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      502.14 µs/iter 505.63 µs  █
                    (482.13 µs … 721.58 µs) 610.96 µs  █▂▃▄
                    ( 78.20 kb …   2.04 mb) 518.51 kb ▂████▄▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        435.26 µs/iter 435.96 µs    █
                    (416.17 µs … 701.33 µs) 499.96 µs    ██
                    ( 35.90 kb … 693.87 kb) 110.89 kb ▁▁▄██▆▅▃▂▂▂▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 412.51 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 502.14 µs
                       Alien ┤■■■■■■■■■ 435.26 µs
                             └                                            ┘

summary
  Preact
   1.06x faster than Alien
   1.22x faster than Lattice
  ✓ Completed in 10.87s

Running: computed-chains

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       402.19 µs/iter 406.17 µs    █
                    (389.67 µs … 458.50 µs) 434.13 µs    █ ▃
                    (408.00  b … 288.45 kb) 823.06  b ▁▁▅█▆█▄▅▃█▂▂▁▂▁▁▁▁▁▂▁

Lattice                      457.47 µs/iter 459.25 µs    █
                    (447.33 µs … 510.04 µs) 485.42 µs    █▄
                    (488.00  b … 284.99 kb)   1.09 kb ▁▁▁██▇▅▄▃▃▄▂▂▁▁▁▁▁▁▁▁

Alien                        366.46 µs/iter 361.75 µs  █
                    (346.88 µs … 472.08 µs) 451.29 µs  █▄
                    (408.00  b … 287.49 kb) 784.26  b ▁██▅▃▂▂▁▁▁▁▁▁▁▁▁▃▃▂▂▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■ 402.19 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 457.47 µs
                       Alien ┤ 366.46 µs
                             └                                            ┘

summary
  Alien
   1.1x faster than Preact
   1.25x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       217.95 µs/iter 220.58 µs   █
                    (210.33 µs … 280.04 µs) 231.50 µs   █     ▇ ▄
                    (120.00  b … 354.90 kb)   1.29 kb ▁▁██▃▆▃▃███▆▃▃▃▂▃▂▁▁▁

Lattice                      225.81 µs/iter 226.54 µs     █
                    (216.08 µs … 309.13 µs) 248.42 µs     █
                    ( 48.00  b … 413.49 kb)   1.75 kb ▁▁▁▂█▇█▄▄▃▂▂▁▁▁▁▁▁▁▁▁

Alien                        221.14 µs/iter 223.13 µs     █
                    (211.88 µs … 274.92 µs) 243.13 µs     █
                    ( 48.00  b … 445.90 kb)   1.56 kb ▁▁▂██▅▇▇▅▃▂▂▂▂▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 217.95 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 225.81 µs
                       Alien ┤■■■■■■■■■■■■■■ 221.14 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.04x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       110.18 µs/iter 111.17 µs      █
                    (105.25 µs … 267.42 µs) 121.21 µs     ▃█
                    (104.00  b …   1.21 mb)   1.07 kb ▁▁▂▂██▃▃▄█▂▁▁▁▁▁▁▁▁▁▁

Lattice                      111.63 µs/iter 112.50 µs  █
                    (109.46 µs … 451.67 µs) 124.54 µs  █
                    ( 48.00  b … 769.66 kb)   1.29 kb ▇█▂▄▃▇▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        105.35 µs/iter 106.75 µs    ▅█
                    (102.25 µs … 134.50 µs) 113.83 µs   ▅██    ▄
                    ( 48.00  b … 285.90 kb) 805.56  b ▁▁███▄▄▅▆█▄▂▂▁▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 110.18 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 111.63 µs
                       Alien ┤ 105.35 µs
                             └                                            ┘

summary
  Alien
   1.05x faster than Preact
   1.06x faster than Lattice
  ✓ Completed in 10.83s

Running: conditional-deps

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       586.55 µs/iter 584.63 µs   █▄
                    (559.21 µs … 764.83 µs) 697.00 µs   ██
                    (131.23 kb …   1.33 mb) 859.73 kb ▁▂██▇▄▂▂▁▁▁▁▁▂▂▁▁▁▁▁▁

Lattice                      441.02 µs/iter 442.67 µs     █
                    (431.21 µs … 489.92 µs) 467.29 µs   ▅▅█▆▄
                    (504.00  b … 592.49 kb)   1.10 kb ▁▃█████▆▅▄▃▃▃▂▂▁▂▁▁▁▁

Alien                          1.01 ms/iter 561.13 µs █
                     (542.58 µs … 12.73 ms)  11.47 ms █
                    ( 30.38 kb …   1.16 mb) 701.53 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■ 586.55 µs
                     Lattice ┤ 441.02 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.01 ms
                             └                                            ┘

summary
  Lattice
   1.33x faster than Preact
   2.28x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       927.51 µs/iter 925.92 µs   █
                      (892.50 µs … 1.34 ms)   1.12 ms  ▆█
                    (132.44 kb …   1.33 mb) 858.46 kb ▃███▅▂▂▂▂▂▂▁▂▁▁▁▁▁▁▁▁

Lattice                      914.42 µs/iter 922.79 µs     █
                    (889.96 µs … 994.71 µs) 966.13 µs    ▇█▂
                    (504.00  b …   1.02 mb)   2.75 kb ▂▁▁███▇▅▅▃▅▇▃▃▂▂▂▂▁▁▁

Alien                          1.29 ms/iter 875.00 µs █
                     (829.21 µs … 12.12 ms)  11.71 ms █
                    (119.62 kb …   1.12 mb) 701.08 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■ 927.51 µs
                     Lattice ┤ 914.42 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.29 ms
                             └                                            ┘

summary
  Lattice
   1.01x faster than Preact
   1.41x faster than Alien
  ✓ Completed in 8.68s

Running: dense-updates

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   167.18 µs/iter 170.29 µs  ██
                    (156.33 µs … 285.54 µs) 218.83 µs ▆███▄▆▄▃▂▁▂▂▂▁▁▁▁▁▁▁▁
                  gc(  1.40 ms …   4.50 ms)  10.33 kb (456.00  b…  1.07 mb)

Preact - 75% dense updates   239.81 µs/iter 245.04 µs ▄▆   ▆█
                    (223.13 µs … 340.54 µs) 286.83 µs ██▅▂▃███▇▃▂▂▁▂▁▁▁▁▂▂▁
                  gc(  1.39 ms …   3.52 ms)  34.72 kb (456.00  b…  1.16 mb)

Preact - 90% dense updates   282.78 µs/iter 289.46 µs █     ▂
                    (268.38 µs … 348.54 µs) 328.38 µs ██▂▁▂██▇▅▃▁▂▁▂▁▁▁▁▁▁▁
                  gc(  1.36 ms …   2.30 ms)  10.05 kb (456.00  b…136.95 kb)

Preact - 100% dense updates  322.97 µs/iter 326.83 µs       █▅▂
                    (300.33 µs … 397.79 µs) 368.29 µs ▁▄▃▄▄████▄▃▃▂▁▁▁▁▁▁▁▁
                  gc(  1.31 ms …   2.72 ms)   5.33 kb (456.00  b… 72.45 kb)

Lattice - 50% dense updates  159.27 µs/iter 162.92 µs  █
                    (150.38 µs … 322.63 µs) 192.63 µs ▄█▆▄▄▇█▆▃▂▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.44 ms …   4.87 ms)  38.91 kb (504.00  b…  2.10 mb)

Lattice - 75% dense updates  239.12 µs/iter 244.50 µs ▆    ██▅▂
                    (222.79 µs … 284.21 µs) 281.04 µs ██▆▂▂████▄▃▃▂▂▂▂▁▁▂▁▁
                  gc(  1.44 ms …   2.40 ms)  29.67 kb (504.00  b…315.27 kb)

Lattice - 90% dense updates  282.75 µs/iter 289.63 µs █     ▃▃
                    (267.42 µs … 338.04 µs) 320.46 µs █▆▁▁▁▃██▆▇▄▂▂▂▁▂▁▁▁▁▁
                  gc(  1.44 ms …   2.28 ms)   2.70 kb (504.00  b…124.99 kb)

Lattice - 100% dense updates 319.50 µs/iter 323.13 µs      ▅█▄
                    (298.79 µs … 387.92 µs) 358.21 µs ▂▄▃▃▄███▇▆▄▂▃▂▂▂▂▁▂▂▁
                  gc(  1.36 ms …   2.46 ms)   5.14 kb (456.00  b… 72.49 kb)

Alien - 50% dense updates    154.61 µs/iter 158.58 µs  █
                    (145.17 µs … 236.00 µs) 193.92 µs ▄█▆▃▅▅▃▄▄▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.50 ms …   4.69 ms)  35.96 kb (504.00  b…  1.37 mb)

Alien - 75% dense updates    232.81 µs/iter 238.79 µs  █▇  █▆▆
                    (215.75 µs … 307.54 µs) 279.25 µs ███▃▂████▆▃▃▃▃▂▂▂▁▁▂▁
                  gc(  1.47 ms …   3.05 ms)  26.21 kb (504.00  b…319.27 kb)

Alien - 90% dense updates    280.91 µs/iter 285.21 µs      ▄█▄
                    (260.08 µs … 344.38 µs) 331.08 µs ▂▆▄▄▇███▇▃▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   2.67 ms)   4.97 kb (504.00  b… 99.99 kb)

Alien - 100% dense updates   300.07 µs/iter 306.00 µs █     ▆
                    (283.67 µs … 353.33 µs) 340.13 µs █▅▁▁▂████▄▃▂▂▃▃▂▁▁▁▁▁
                  gc(  1.38 ms …   2.90 ms)   7.56 kb (504.00  b…116.49 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■■ 167.18 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■■■■■■■ 239.81 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 282.78 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 322.97 µs
 Lattice - 50% dense updates ┤■ 159.27 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■ 239.12 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 282.75 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 319.50 µs
   Alien - 50% dense updates ┤ 154.61 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■■■■■■ 232.81 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 280.91 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 300.07 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.06…+1.03x faster than Lattice - $changeRatio% dense updates
   +1.08…+1.08x faster than Preact - $changeRatio% dense updates
  ✓ Completed in 22.38s

Running: diamond-deps

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       646.70 µs/iter 650.08 µs    █▄▄ ▄
                    (631.25 µs … 732.17 µs) 678.21 µs    ███▆██
                    (456.00  b … 233.71 kb) 782.34  b ▃▂▂███████▆▅▄▄▃▂▁▁▁▂▁

Lattice                      923.47 µs/iter 927.88 µs     █
                      (902.63 µs … 1.00 ms) 973.04 µs    ██▃
                    (504.00  b … 673.49 kb)   1.38 kb ▂▁▁███▅▆▅▂▄▂▂▂▂▁▂▂▁▁▁

Alien                        587.14 µs/iter 592.17 µs  ▂█
                    (567.17 µs … 837.08 µs) 670.21 µs  ██▅ ▄
                    (504.00  b … 378.89 kb)   1.07 kb ▄██████▄▃▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■ 646.70 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 923.47 µs
                       Alien ┤ 587.14 µs
                             └                                            ┘

summary
  Alien
   1.1x faster than Preact
   1.57x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       334.47 µs/iter 335.33 µs   █
                    (326.08 µs … 568.21 µs) 368.63 µs   █▅
                    (  4.68 kb … 631.13 kb)  56.55 kb ▂▂███▆▃▃▂▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      483.09 µs/iter 488.17 µs   █▂
                    (469.83 µs … 676.08 µs) 521.96 µs   ██▅
                    (  1.18 kb … 340.68 kb)  55.68 kb ▃▂███▆▄▄█▃▃▃▂▂▂▁▁▂▁▁▁

Alien                        309.46 µs/iter 305.54 µs  █
                      (284.17 µs … 1.87 ms) 658.96 µs ▆█
                    ( 15.09 kb … 452.09 kb)  56.53 kb ███▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■ 334.47 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 483.09 µs
                       Alien ┤ 309.46 µs
                             └                                            ┘

summary
  Alien
   1.08x faster than Preact
   1.56x faster than Lattice

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       724.09 µs/iter 732.92 µs   ██
                      (702.13 µs … 1.00 ms) 791.88 µs   ██   ▆
                    (504.00  b … 670.07 kb)   1.55 kb ▃▃███▆▅█▆▄▂▂▁▁▂▁▁▁▁▁▁

Lattice                        1.05 ms/iter   1.05 ms    █▅
                        (1.03 ms … 1.18 ms)   1.10 ms   ▆██▄
                    (456.00  b …   1.12 mb)   3.09 kb ▁▃█████▆▆▃▂▂▂▂▂▁▂▁▁▁▁

Alien                        608.91 µs/iter 615.33 µs  █▅
                    (590.42 µs … 765.79 µs) 710.29 µs  ██ ▄
                    ( 43.29 kb …   1.44 mb) 393.00 kb ▂██▇█▄▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■ 724.09 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.05 ms
                       Alien ┤ 608.91 µs
                             └                                            ┘

summary
  Alien
   1.19x faster than Preact
   1.72x faster than Lattice
  ✓ Completed in 10.86s

Running: effect-triggers

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       320.85 µs/iter 323.17 µs      █
                    (281.58 µs … 592.79 µs) 406.08 µs      ██▆
                    (648.00  b …   2.16 mb) 157.22 kb ▁▁▁▁▁███▄▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      296.94 µs/iter 299.29 µs  █
                    (284.75 µs … 689.00 µs) 404.54 µs  █
                    (  4.15 kb …   1.53 mb) 166.66 kb ▂██▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        229.18 µs/iter 222.04 µs   █
                    (208.42 µs … 509.29 µs) 304.38 µs   █
                    (504.00  b …   2.14 mb) 157.16 kb ▁▁█▅▂▁▁▁▁▁▁▁▁▁▁▁▁▄▂▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 320.85 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■ 296.94 µs
                       Alien ┤ 229.18 µs
                             └                                            ┘

summary
  Alien
   1.3x faster than Lattice
   1.4x faster than Preact

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          225.53 µs/iter 241.13 µs  █
                    (205.88 µs … 363.83 µs) 266.33 µs  █          ▆
                    (120.00  b … 387.40 kb)   1.54 kb ▂█▇▄▂▁▁▁▁▁▆▆█▅▃▁▁▁▁▁▁

Lattice - 10 effects         261.71 µs/iter 264.50 µs   █
                    (254.33 µs … 368.04 µs) 291.75 µs   █▂  ▂
                    (120.00  b … 526.80 kb)   2.17 kb ▂▂██▇▄█▃▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien - 10 effects           222.41 µs/iter 223.25 µs   █
                    (216.21 µs … 323.00 µs) 243.92 µs   █
                    (120.00  b … 783.32 kb)   1.78 kb ▁▂█▅▇▇▄▄▃▂▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤■■■ 225.53 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 261.71 µs
          Alien - 10 effects ┤ 222.41 µs
                             └                                            ┘

summary
  Alien - 10 effects
   1.01x faster than Preact - 10 effects
   1.18x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         8.41 µs/iter   8.33 µs     █
                      (7.92 µs … 151.04 µs)   9.25 µs    ▄█
                    (312.00  b … 491.39 kb)  20.63 kb ▁▁▆██▄▅▅▇▃▂▂▂▁▁▁▁▁▁▁▁

Lattice                       10.98 µs/iter   7.13 µs ▃█
                        (6.63 µs … 2.86 ms)  17.46 µs ██
                    (184.00  b … 493.20 kb)  23.74 kb ██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          6.41 µs/iter   6.33 µs    █▂
                      (5.96 µs … 172.08 µs)   7.29 µs    ██ ▃
                    (728.00  b … 349.70 kb)  19.75 kb ▁▃▇██▅█▅▂▂▁▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■ 8.41 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 10.98 µs
                       Alien ┤ 6.41 µs
                             └                                            ┘

summary
  Alien
   1.31x faster than Preact
   1.71x faster than Lattice
  ✓ Completed in 10.93s

Running: filtered-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        300.26 µs/iter 314.54 µs  █
                    (283.42 µs … 374.75 µs) 337.71 µs  █▂
                    (120.00  b … 512.40 kb)   1.72 kb ▁██▆▄▄▂▂▂▂▁▅▂▃▂▁▇▃▂▂▁

Lattice - 90% filtered       392.25 µs/iter 393.96 µs   █
                    (382.79 µs … 455.00 µs) 424.92 µs   █
                    (408.00  b … 355.99 kb)   1.08 kb ▂▁█▇█▅▄▃▃▃▂▂▂▂▁▁▁▁▁▁▁

Alien - 90% filtered         296.96 µs/iter 290.88 µs  █
                    (279.04 µs … 388.67 µs) 368.58 µs  █
                    ( 32.00  b … 397.40 kb)   1.57 kb ▁█▅▆▁▁▁▁▁▁▁▁▁▁▁▁▁▅▂▂▁

                             ┌                                            ┐
       Preact - 90% filtered ┤■ 300.26 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 392.25 µs
        Alien - 90% filtered ┤ 296.96 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1.01x faster than Preact - 90% filtered
   1.32x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       840.79 µs/iter 842.13 µs   █
                      (822.33 µs … 1.01 ms) 936.54 µs   █
                    (234.87 kb … 424.23 kb) 235.10 kb ▁▄██▆▄▂▂▁▂▁▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter      921.87 µs/iter 923.63 µs   █
                      (901.04 µs … 1.11 ms)   1.02 ms   █▇
                    (196.15 kb … 752.37 kb) 235.49 kb ▂▃███▄▂▂▁▁▂▁▁▁▁▁▁▁▁▁▁

Alien - toggle filter        769.99 µs/iter 769.63 µs   █
                    (749.75 µs … 912.04 µs) 868.25 µs   █
                    (234.87 kb … 509.87 kb) 235.18 kb ▁▆██▅▃▂▁▁▁▁▁▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■■■■■■■■■■ 840.79 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 921.87 µs
       Alien - toggle filter ┤ 769.99 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.09x faster than Preact - toggle filter
   1.2x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       412.37 µs/iter 417.08 µs   █
                    (399.33 µs … 485.12 µs) 449.42 µs   ██   ▇
                    (408.00  b … 296.94 kb) 934.04  b ▂▂██▆▄▆██▄▃▂▂▂▁▂▁▁▁▁▁

Lattice                      572.75 µs/iter 577.75 µs    █▅
                    (557.92 µs … 669.88 µs) 610.25 µs   ▇██▄  ▃▂
                    (504.00  b …   1.07 mb)   1.60 kb ▁▃████▇▆██▄▂▂▃▂▂▁▁▁▁▁

Alien                        420.25 µs/iter 421.50 µs  ▃█
                    (410.54 µs … 515.21 µs) 473.71 µs  ██▂
                    (504.00  b … 346.49 kb) 862.04  b ▃███▆▅▄▂▂▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 412.37 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 572.75 µs
                       Alien ┤■■ 420.25 µs
                             └                                            ┘

summary
  Preact
   1.02x faster than Alien
   1.39x faster than Lattice
  ✓ Completed in 10.84s

Running: scaling-subscribers

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       16.94 µs/iter  16.17 µs █
                      (14.75 µs … 47.54 µs)  35.58 µs ██▂▃▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.46 ms …   2.94 ms)   6.58 kb (456.00  b…138.27 kb)

Preact - 50 subscribers       28.74 µs/iter  27.17 µs █
                      (26.29 µs … 81.00 µs)  63.79 µs █▂▁▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.56 ms …   2.76 ms)  11.70 kb (456.00  b…330.37 kb)

Preact - 100 subscribers      50.82 µs/iter  51.20 µs                 █   █
                      (49.85 µs … 51.65 µs)  51.27 µs █▁▁█▁▁▁█▁▁▁█▁█▁██▁▁██
                  gc(  2.61 ms …   3.99 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     115.87 µs/iter 122.25 µs  █▇▆▄▇
                    (104.38 µs … 158.79 µs) 142.13 µs ▄██████▄▆▆▇▆▇▆▃▃▂▂▁▁▂
                  gc(  1.53 ms …   2.89 ms)  21.13 kb (456.00  b…156.95 kb)

Preact - 400 subscribers     312.34 µs/iter 319.88 µs     ██ ▂▃▂
                    (283.38 µs … 375.67 µs) 367.08 µs ▃▃▅███████▄▅▃▃▃▂▂▁▂▂▂
                  gc(  1.42 ms …   2.97 ms)  15.11 kb (456.00  b…116.45 kb)

Lattice - 25 subscribers      15.64 µs/iter  14.79 µs █▅
                      (13.17 µs … 54.83 µs)  38.33 µs ██▄▂▁▁▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁
                  gc(  1.56 ms …   3.35 ms)   7.12 kb (504.00  b…214.77 kb)

Lattice - 50 subscribers      29.93 µs/iter  28.04 µs █
                      (27.29 µs … 89.13 µs)  71.46 µs █▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.51 ms …   3.03 ms)   6.25 kb (152.00  b…124.99 kb)

Lattice - 100 subscribers     52.45 µs/iter  52.60 µs              █
                      (52.04 µs … 52.84 µs)  52.81 µs █▁███▁▁█▁▁▁▁▁███▁█▁▁█
                  gc(  2.59 ms …   4.09 ms)   0.11  b (  0.10  b…  0.12  b)

Lattice - 200 subscribers    116.52 µs/iter 116.96 µs     █▂
                    (107.67 µs … 159.04 µs) 145.58 µs ▄▃▅███▅▂▁▁▁▁▁▂▁▁▁▁▁▁▁
                  gc(  1.51 ms …   2.67 ms)  26.09 kb (504.00  b…156.99 kb)

Lattice - 400 subscribers    318.71 µs/iter 326.04 µs     ▅██▅▂▂
                    (286.96 µs … 386.96 µs) 376.92 µs ▂▃▅▆██████▆▅▂▄▂▂▂▂▂▂▂
                  gc(  1.45 ms …   2.93 ms)   6.12 kb (504.00  b… 99.99 kb)

Alien - 25 subscribers        16.46 µs/iter  15.96 µs  █
                      (13.42 µs … 69.25 µs)  39.21 µs ▅██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.57 ms …   2.99 ms)   5.97 kb (456.00  b…109.32 kb)

Alien - 50 subscribers        25.07 µs/iter  25.10 µs     █
                      (24.96 µs … 25.22 µs)  25.19 µs ██▁▁█▁██▁▁▁▁█▁▁▁█▁▁▁█
                  gc(  2.13 ms …   3.04 ms)  19.67  b (  0.10  b…263.51  b)

Alien - 100 subscribers       50.04 µs/iter  50.17 µs   █▃
                      (49.75 µs … 50.81 µs)  50.42 µs ▆▁██▆▁▁▁▆▁▁▁▆▁▁▆▁▁▁▁▆
                  gc(  2.55 ms …   2.98 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 200 subscribers      108.06 µs/iter 110.21 µs █▃
                    (104.08 µs … 149.21 µs) 134.88 µs ██▄▅▆█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.55 ms …   3.01 ms)  18.65 kb (456.00  b…124.95 kb)

Alien - 400 subscribers      326.78 µs/iter 331.92 µs   ▆█▅
                    (294.83 µs … 572.96 µs) 444.96 µs ▄▇████▆▄▃▂▂▁▃▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   4.61 ms)   9.88 kb (456.00  b…116.45 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 16.94 µs
     Preact - 50 subscribers ┤■ 28.74 µs
    Preact - 100 subscribers ┤■■■■ 50.82 µs
    Preact - 200 subscribers ┤■■■■■■■■■■■ 115.87 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 312.34 µs
    Lattice - 25 subscribers ┤ 15.64 µs
    Lattice - 50 subscribers ┤■■ 29.93 µs
   Lattice - 100 subscribers ┤■■■■ 52.45 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■ 116.52 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 318.71 µs
      Alien - 25 subscribers ┤ 16.46 µs
      Alien - 50 subscribers ┤■ 25.07 µs
     Alien - 100 subscribers ┤■■■■ 50.04 µs
     Alien - 200 subscribers ┤■■■■■■■■■■ 108.06 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 326.78 µs
                             └                                            ┘

summary
  Preact - $sources subscribers
   +1.05…-1.03x faster than Alien - $sources subscribers
   +1.02…-1.08x faster than Lattice - $sources subscribers
  ✓ Completed in 35.88s

Running: signal-updates

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          354.10 µs/iter 326.62 µs █
                    (313.83 µs … 577.42 µs) 569.21 µs █▇
                    (408.00  b … 358.23 kb)   1.08 kb ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆▂

Lattice - write only         235.72 µs/iter 407.08 µs █
                     (94.71 µs … 500.63 µs) 462.83 µs █                ▃
                    (120.00  b … 443.90 kb)   1.47 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▃▄▃

Alien - write only            71.50 µs/iter  47.63 µs █
                     (45.38 µs … 598.04 µs) 570.04 µs █
                    ( 48.00  b … 717.40 kb) 482.72  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           233.89 µs/iter 406.29 µs █                  ▂
                     (94.67 µs … 488.54 µs) 425.75 µs █                  █
                    ( 48.00  b … 600.40 kb)   1.13 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▂

Lattice - read only          215.54 µs/iter 404.04 µs █
                     (38.54 µs … 684.54 µs) 432.58 µs █                  ▇
                    ( 48.00  b … 544.40 kb)   1.14 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▇█▂

Alien - read only             93.56 µs/iter  61.79 µs █
                     (59.25 µs … 646.29 µs) 599.00 µs █
                    ( 32.00  b … 717.40 kb) 537.01  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    381.97 µs/iter 342.04 µs █
                    (331.50 µs … 889.42 µs) 869.88 µs █
                    (408.00  b … 288.49 kb) 937.87  b █▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▂

Lattice - read/write mixed   310.29 µs/iter 753.92 µs █
                     (94.67 µs … 838.17 µs) 808.88 µs █
                    ( 48.00  b … 632.90 kb)   1.44 kb █▁▁▁▁▁▄▅▁▁▁▁▁▁▁▁▁▁▁█▃

Alien - read/write mixed     349.34 µs/iter 207.63 µs █
                      (126.38 µs … 1.49 ms)   1.43 ms █
                    (408.00  b … 160.49 kb) 680.33  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 354.10 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 235.72 µs
          Alien - write only ┤ 71.50 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■ 233.89 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 215.54 µs
           Alien - read only ┤■■ 93.56 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 381.97 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 310.29 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 349.34 µs
                             └                                            ┘

summary
  Alien - write only
   1.31x faster than Alien - read only
   3.01x faster than Lattice - read only
   3.27x faster than Preact - read only
   3.3x faster than Lattice - write only
   4.34x faster than Lattice - read/write mixed
   4.89x faster than Alien - read/write mixed
   4.95x faster than Preact - write only
   5.34x faster than Preact - read/write mixed
  ✓ Completed in 10.83s

Running: sparse-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   41.39 µs/iter  44.83 µs ▃█
                     (34.92 µs … 108.00 µs)  87.17 µs ██▃▄█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   3.41 ms)   9.46 kb (456.00  b…273.48 kb)

Preact - 15% sparse updates   46.54 µs/iter  44.67 µs █
                      (43.29 µs … 82.71 µs)  71.79 µs █▇▁▁▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   2.88 ms)   7.66 kb (456.00  b…229.67 kb)

Preact - 20% sparse updates   56.86 µs/iter  57.21 µs                     █
                      (55.81 µs … 57.63 µs)  57.30 µs ██▁▁▁▁▁▁▁█▁▁▁████▁███
                  gc(  2.49 ms …   3.94 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   75.48 µs/iter  76.83 µs  ▂  ▄█▃▃
                     (71.17 µs … 109.75 µs)  88.58 µs ██▅▇█████▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   2.83 ms)  10.53 kb (456.00  b…132.95 kb)

Lattice - 10% sparse updates  33.57 µs/iter  32.29 µs ▂█
                      (30.38 µs … 87.08 µs)  70.04 µs ██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.46 ms …   2.82 ms)  11.66 kb (504.00  b…  1.19 mb)

Lattice - 15% sparse updates  48.56 µs/iter  47.63 µs ▅█
                     (45.04 µs … 171.54 µs)  83.79 µs ██▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   2.80 ms)   9.83 kb (504.00  b…132.59 kb)

Lattice - 20% sparse updates  58.69 µs/iter  58.90 µs    █  █
                      (58.26 µs … 59.12 µs)  59.02 µs █▁▁█▁▁█▁▁▁▁██▁▁█▁█▁██
                  gc(  2.53 ms …   3.15 ms)   0.11  b (  0.10  b…  0.12  b)

Lattice - 25% sparse updates  79.82 µs/iter  80.25 µs     █
                     (74.63 µs … 119.67 µs)  99.33 µs ▅▃▃▇██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   2.80 ms)   9.34 kb (504.00  b…124.99 kb)

Alien - 10% sparse updates    31.01 µs/iter  29.92 µs █
                     (29.25 µs … 116.17 µs)  61.33 µs █▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.46 ms …   3.44 ms)   8.81 kb (504.00  b…227.29 kb)

Alien - 15% sparse updates    44.03 µs/iter  43.88 µs ▂█
                      (43.21 µs … 63.63 µs)  55.42 µs ██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   2.95 ms)   4.78 kb (456.00  b… 72.45 kb)

Alien - 20% sparse updates    55.78 µs/iter  55.92 µs █            ██
                      (55.37 µs … 56.15 µs)  56.13 µs ██▁▁▁▁▁█▁█▁▁▁██▁█▁▁▁█
                  gc(  2.46 ms …   4.03 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    74.99 µs/iter  75.13 µs    █
                      (71.67 µs … 97.50 µs)  91.54 µs ▅▄██▇▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   2.45 ms)   6.33 kb (456.00  b…124.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■■■■■■ 41.39 µs
 Preact - 15% sparse updates ┤■■■■■■■■■■■ 46.54 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■ 56.86 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 75.48 µs
Lattice - 10% sparse updates ┤■■ 33.57 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■ 48.56 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■ 58.69 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 79.82 µs
  Alien - 10% sparse updates ┤ 31.01 µs
  Alien - 15% sparse updates ┤■■■■■■■■■ 44.03 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■■■■■■ 55.78 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 74.99 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   +1.01…+1.34x faster than Preact - $changeRatio% sparse updates
   +1.06…+1.08x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 31.91s

Running: wide-fanout

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       312.07 µs/iter 314.08 µs   █
                    (303.33 µs … 452.04 µs) 343.00 µs  ▂█▅▄
                    ( 54.80 kb … 692.59 kb)  56.67 kb ▂████▇▅▆▄▃▂▁▂▁▂▂▂▁▁▁▁

Lattice                      477.43 µs/iter 477.75 µs     █
                    (458.58 µs … 677.21 µs) 526.83 µs     █▅
                    ( 55.18 kb … 554.18 kb)  56.51 kb ▁▁▂▁██▅▃▄▂▂▂▂▁▁▁▁▁▁▁▁

Alien                        300.27 µs/iter 302.63 µs  █
                    (290.58 µs … 450.00 µs) 340.46 µs  █▆
                    (  2.68 kb … 599.09 kb)  56.64 kb ▁███▄▄▂▆▃▂▂▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■ 312.07 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 477.43 µs
                       Alien ┤ 300.27 µs
                             └                                            ┘

summary
  Alien
   1.04x faster than Preact
   1.59x faster than Lattice

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       367.56 µs/iter 369.58 µs   █
                    (356.75 µs … 600.50 µs) 405.63 µs   █▃
                    (  5.87 kb …   1.61 mb)   8.02 kb ▂▂██▆▄▄▃▂▂▂▂▂▂▁▁▁▁▁▁▁

Lattice                      488.40 µs/iter 489.21 µs   █
                    (475.83 µs … 585.38 µs) 539.08 µs   █▆
                    (  5.96 kb … 335.96 kb)   6.58 kb ▁▁██▅▃▄▂▂▂▂▁▁▂▁▁▁▁▁▁▁

Alien                        300.38 µs/iter 300.46 µs  █
                    (292.46 µs … 426.00 µs) 349.92 µs  ██
                    (  5.52 kb …   1.27 mb)   8.38 kb ▁███▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■ 367.56 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 488.40 µs
                       Alien ┤ 300.38 µs
                             └                                            ┘

summary
  Alien
   1.22x faster than Preact
   1.63x faster than Lattice

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       262.04 µs/iter 262.21 µs    █
                    (251.25 µs … 330.21 µs) 296.25 µs    █
                    (  5.59 kb … 547.37 kb)   7.20 kb ▁▁▂██▄▄▃▂▁▁▂▂▁▂▁▁▁▁▁▁

Lattice                      367.34 µs/iter 371.46 µs   █
                    (357.25 µs … 457.67 µs) 399.96 µs   █▇   ▂
                    (  5.87 kb … 559.93 kb)   7.37 kb ▁▁███▅▄█▃▂▁▂▁▁▁▁▁▁▁▂▁

Alien                        274.33 µs/iter 276.13 µs    █
                    (261.96 µs … 429.54 µs) 310.25 µs    █
                    (  4.46 kb … 903.31 kb)   8.43 kb ▁▁▁██▅▇▄▂▂▂▁▁▁▁▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 262.04 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 367.34 µs
                       Alien ┤■■■■ 274.33 µs
                             └                                            ┘

summary
  Preact
   1.05x faster than Alien
   1.4x faster than Lattice
  ✓ Completed in 10.81s

Running: write-heavy

clk: ~3.04 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        55.96 µs/iter  56.37 µs   █
                     (53.00 µs … 305.17 µs)  72.96 µs   █
                    ( 32.00  b … 390.23 kb) 835.32  b ▁▄█▅▅▂▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      107.58 µs/iter 107.38 µs  █
                     (97.75 µs … 261.88 µs) 181.79 µs  █▇
                    ( 44.26 kb …   1.14 mb) 547.64 kb ▂██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                         48.70 µs/iter  45.79 µs ▄█
                       (43.71 µs … 1.51 ms) 118.25 µs ██
                    ( 32.00  b …   1.99 mb) 873.67  b ██▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■ 55.96 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 107.58 µs
                       Alien ┤ 48.70 µs
                             └                                            ┘

summary
  Alien
   1.15x faster than Preact
   2.21x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        32.37 µs/iter  32.04 µs █
                      (30.63 µs … 95.67 µs)  57.25 µs █▂
                    ( 32.00  b … 344.99 kb) 556.84  b ██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      100.51 µs/iter 100.00 µs  █
                     (91.58 µs … 248.83 µs) 171.79 µs  █▄
                    ( 82.87 kb …   1.18 mb) 547.42 kb ▂██▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                         40.45 µs/iter  39.17 µs  █
                     (37.75 µs … 109.50 µs)  77.92 µs  █
                    ( 32.00  b … 241.22 kb) 596.75  b ▂█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 32.37 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 100.51 µs
                       Alien ┤■■■■ 40.45 µs
                             └                                            ┘

summary
  Preact
   1.25x faster than Alien
   3.1x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        95.73 µs/iter  97.08 µs     █
                     (90.63 µs … 262.04 µs) 109.21 µs     █  ▂
                    (  2.46 kb … 802.46 kb)   6.85 kb ▁▁▂██▃▄█▃▂▁▂▁▁▁▁▁▁▁▁▁

Lattice                      132.80 µs/iter 144.54 µs        █
                     (95.13 µs … 328.75 µs) 220.92 µs ▇      █▇
                    (  5.91 kb …   1.49 mb) 377.94 kb █▇▂▁▁▁▁██▇▂▁▁▁▁▁▁▁▁▂▁

Alien                        136.86 µs/iter 137.21 µs  █
                    (132.67 µs … 252.21 µs) 161.54 µs  █
                    (  5.52 kb … 790.57 kb)   6.97 kb ▂█▃▅▃▂▁▃▁▁▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 95.73 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 132.80 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 136.86 µs
                             └                                            ┘

summary
  Preact
   1.39x faster than Lattice
   1.43x faster than Alien
  ✓ Completed in 10.84s

Summary:
  Total: 12
  Success: 12
  Failed: 0