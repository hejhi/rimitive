Found 12 benchmark suites

Running: batch-operations

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       545.59 µs/iter 546.08 µs    █
                    (519.96 µs … 684.67 µs) 641.13 µs   ██
                    ( 10.95 kb …   1.32 mb) 937.44 kb ▁▁██▅▆▃▂▂▁▁▁▁▁▂▂▂▁▁▁▁

Lattice                      720.42 µs/iter 716.42 µs  █▂
                    (706.04 µs … 881.63 µs) 814.58 µs  ██
                    (446.41 kb …   1.36 mb) 938.52 kb ▁██▃▂▁▁▁▁▁▁▁▁▁▁▂▂▁▁▁▁

Alien                        424.08 µs/iter 424.50 µs  █
                    (420.92 µs … 577.71 µs) 446.25 µs  █ ▂
                    (456.00  b … 377.99 kb) 943.86  b ▂█▄█▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■ 545.59 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 720.42 µs
                       Alien ┤ 424.08 µs
                             └                                            ┘

summary
  Alien
   1.29x faster than Preact
   1.7x faster than Lattice

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       131.03 µs/iter 129.21 µs  █
                    (123.88 µs … 307.46 µs) 212.21 µs  █
                    ( 43.62 kb … 674.66 kb) 204.56 kb ▂█▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      233.65 µs/iter 232.79 µs   █
                    (223.25 µs … 441.13 µs) 311.58 µs  ██
                    ( 75.62 kb … 771.69 kb) 205.63 kb ▁███▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        216.78 µs/iter 216.71 µs   █
                    (207.50 µs … 357.58 µs) 292.00 µs  ▂█
                    (432.00  b … 907.47 kb) 150.14 kb ▁██▆▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 131.03 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 233.65 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 216.78 µs
                             └                                            ┘

summary
  Preact
   1.65x faster than Alien
   1.78x faster than Lattice

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       410.18 µs/iter 413.29 µs  █
                    (394.67 µs … 547.75 µs) 491.17 µs  █▄ ▅
                    ( 99.17 kb …   1.14 mb) 516.76 kb ▁██▄█▃▂▂▁▁▁▁▁▁▁▁▁▁▁▂▁

Lattice                      553.30 µs/iter 550.33 µs  █
                    (536.88 µs … 723.96 µs) 653.38 µs  █
                    (690.18 kb …   2.08 mb)   1.12 mb ▁█▄▃▃▂▂▁▁▁▁▁▁▁▂▂▁▁▁▁▁

Alien                        433.32 µs/iter 433.25 µs   █
                    (422.21 µs … 588.42 µs) 495.58 µs   █▃
                    ( 71.15 kb … 693.89 kb) 110.89 kb ▆▅██▅▂▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 410.18 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 553.30 µs
                       Alien ┤■■■■■ 433.32 µs
                             └                                            ┘

summary
  Preact
   1.06x faster than Alien
   1.35x faster than Lattice
  ✓ Completed in 10.81s

Running: computed-chains

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       399.20 µs/iter 399.21 µs      █
                    (385.50 µs … 471.46 µs) 434.92 µs      █
                    (408.00  b … 288.45 kb) 818.92  b ▁▁▁▂▆█▇▂▁▂▁▁▁▁▁▁▁▁▁▂▁

Lattice                      527.68 µs/iter 522.54 µs   █
                    (502.75 µs … 699.25 µs) 636.08 µs   █
                    ( 15.95 kb … 969.12 kb) 625.27 kb ▁▁█▆▂▂▁▂▁▂▂▁▁▁▂▁▁▁▁▁▁

Alien                        363.57 µs/iter 351.75 µs   █
                    (338.79 µs … 468.38 µs) 455.92 µs   █
                    (408.00  b … 319.49 kb)   1.12 kb ▁▁█▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃▂

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 399.20 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 527.68 µs
                       Alien ┤ 363.57 µs
                             └                                            ┘

summary
  Alien
   1.1x faster than Preact
   1.45x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       221.20 µs/iter 223.33 µs     █  ▃
                    (210.00 µs … 282.83 µs) 244.04 µs     █  █
                    (120.00  b … 352.40 kb)   1.58 kb ▂▁▁▁█▃▃██▄▂▂▂▂▂▂▂▁▁▁▁

Lattice                      274.35 µs/iter 272.63 µs  █
                    (257.96 µs … 596.25 µs) 403.04 µs  █
                    (120.59 kb …   1.30 mb) 563.43 kb ▁██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        223.83 µs/iter 227.54 µs     █▅
                    (213.29 µs … 296.13 µs) 243.83 µs     ██
                    ( 32.00  b … 482.27 kb)   1.81 kb ▂▂▁▂██▇▅▃█▅▁█▂▃▁▂▂▁▁▁

                             ┌                                            ┐
                      Preact ┤ 221.20 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 274.35 µs
                       Alien ┤■■ 223.83 µs
                             └                                            ┘

summary
  Preact
   1.01x faster than Alien
   1.24x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       112.92 µs/iter 112.63 µs      █
                    (107.67 µs … 275.75 µs) 126.83 µs      █
                    (120.00  b …   1.39 mb)   1.07 kb ▁▂▁▆██▂▃▆▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      128.34 µs/iter 126.83 µs █
                    (123.08 µs … 416.96 µs) 205.54 µs █▄
                    (  2.26 kb … 737.28 kb) 307.25 kb ██▄▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        113.26 µs/iter 112.58 µs   █
                    (110.96 µs … 161.38 µs) 123.50 µs   █
                    ( 48.00  b … 259.40 kb)   1.22 kb ▂▁█▃▁▃▁▃▂▁▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 112.92 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 128.34 µs
                       Alien ┤■ 113.26 µs
                             └                                            ┘

summary
  Preact
   1x faster than Alien
   1.14x faster than Lattice
  ✓ Completed in 10.78s

Running: conditional-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       598.68 µs/iter 595.38 µs    █
                    (570.79 µs … 752.58 µs) 698.58 µs    █
                    (408.91 kb …   1.25 mb) 860.23 kb ▁▁▁█▅▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      590.22 µs/iter 597.63 µs  █      ▇▃
                    (574.79 µs … 647.96 µs) 625.96 µs  █▇     ██▃
                    (504.00  b … 766.99 kb)   1.51 kb ▄███▅▇▅▇███▅▃▁▂▁▁▁▁▁▁

Alien                        990.14 µs/iter 563.38 µs █
                     (546.25 µs … 12.75 ms)  11.54 ms █
                    ( 30.38 kb … 810.89 kb) 700.97 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■ 598.68 µs
                     Lattice ┤ 590.22 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 990.14 µs
                             └                                            ┘

summary
  Lattice
   1.01x faster than Preact
   1.68x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       924.65 µs/iter 935.00 µs   █
                      (894.42 µs … 1.09 ms)   1.04 ms   █
                    (370.59 kb …   1.32 mb) 859.97 kb ▁▇█▅▅▆█▃▂▂▁▁▁▂▁▁▁▁▁▁▁

Lattice                        1.24 ms/iter   1.24 ms    ▆█
                        (1.23 ms … 1.37 ms)   1.29 ms    ██
                    (504.00  b … 609.99 kb)   1.57 kb ▁▁▆███▇▄▂▂▂▁▂▁▁▁▁▁▁▁▁

Alien                          1.26 ms/iter 847.46 µs █
                     (797.96 µs … 11.90 ms)  11.67 ms █
                    (263.75 kb …   1.12 mb) 702.85 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 924.65 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.24 ms
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.26 ms
                             └                                            ┘

summary
  Preact
   1.34x faster than Lattice
   1.37x faster than Alien
  ✓ Completed in 8.66s

Running: dense-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   163.77 µs/iter 163.54 µs  ▂█
                    (155.54 µs … 295.29 µs) 204.88 µs ▅██▅▄▂▂▂▂▂▁▂▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   4.70 ms)  16.88 kb (456.00  b…  1.26 mb)

Preact - 75% dense updates   235.88 µs/iter 237.67 µs   █▆
                    (225.63 µs … 372.58 µs) 277.17 µs ▃███▇▇▄▃▂▂▁▂▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.95 ms)  14.33 kb (456.00  b…  1.02 mb)

Preact - 90% dense updates   277.29 µs/iter 283.04 µs  ▂█▂
                    (267.04 µs … 318.88 µs) 308.13 µs ▄███▂▃▄▆▆▅▃▄▂▂▁▁▂▁▁▁▁
                  gc(  1.39 ms …   2.63 ms)   9.81 kb (456.00  b…136.95 kb)

Preact - 100% dense updates  313.17 µs/iter 317.46 µs  ▃  █
                    (297.58 µs … 445.04 µs) 377.08 µs ▇█▃▆██▆▃▂▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   6.50 ms)  12.37 kb (456.00  b…124.95 kb)

Lattice - 50% dense updates  182.23 µs/iter 181.46 µs  █
                    (179.46 µs … 267.63 µs) 207.25 µs ▅█▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   4.79 ms) 189.98 kb ( 55.65 kb…  2.15 mb)

Lattice - 75% dense updates  289.55 µs/iter 293.08 µs       ▆█▃
                    (274.79 µs … 375.25 µs) 317.42 µs ▇▄▅▃▂▅████▆▄▂▂▂▁▁▁▂▁▁
                  gc(  1.40 ms …   2.67 ms) 159.56 kb ( 47.57 kb…585.67 kb)

Lattice - 90% dense updates  341.67 µs/iter 344.96 µs         ▄█
                    (326.42 µs … 369.92 µs) 361.96 µs ▃▆▄▂▁▂▅▆███▇▅▃▃▂▂▁▁▁▂
                  gc(  1.35 ms …   2.71 ms) 211.19 kb (157.84 kb…353.80 kb)

Lattice - 100% dense updates 377.56 µs/iter 381.13 µs        █▃
                    (359.79 µs … 413.75 µs) 404.96 µs ▂▆▄▁▂▁████▅▄▃▂▂▂▁▂▁▁▁
                  gc(  1.37 ms …   2.86 ms) 219.13 kb (189.09 kb…386.22 kb)

Alien - 50% dense updates    151.44 µs/iter 156.25 µs  ▅█
                    (143.67 µs … 179.38 µs) 167.00 µs ▂██▄▆▂▁▂▃▆▅▅▅▃▃▃▂▂▃▂▁
                  gc(  1.50 ms …   4.73 ms)  38.17 kb (456.00  b…  1.27 mb)

Alien - 75% dense updates    226.97 µs/iter 233.54 µs  █
                    (217.54 µs … 285.42 µs) 251.83 µs ▄█▇▃▂▂▁▂▃█▅▄▂▂▂▂▁▁▁▁▁
                  gc(  1.49 ms …   2.80 ms)  23.58 kb (456.00  b…285.90 kb)

Alien - 90% dense updates    272.11 µs/iter 276.88 µs          ▂█▂
                    (257.46 µs … 299.58 µs) 291.54 µs ▂██▇▃▂▃▅▆████▄▅▃▂▃▂▁▂
                  gc(  1.43 ms …   2.95 ms)   8.46 kb (456.00  b…136.95 kb)

Alien - 100% dense updates   307.14 µs/iter 309.96 µs         ▄█
                    (290.17 µs … 330.33 µs) 326.96 µs ▂▃▂▁▁▁▁▅██▇▆▅▄▂▂▁▁▁▁▁
                  gc(  1.40 ms …   2.75 ms)   5.27 kb (456.00  b…136.95 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■ 163.77 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■■■ 235.88 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■ 277.29 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■ 313.17 µs
 Lattice - 50% dense updates ┤■■■■■ 182.23 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■■ 289.55 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 341.67 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 377.56 µs
   Alien - 50% dense updates ┤ 151.44 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■ 226.97 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■■ 272.11 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 307.14 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.02…+1.08x faster than Preact - $changeRatio% dense updates
   +1.23…+1.2x faster than Lattice - $changeRatio% dense updates
  ✓ Completed in 22.36s

Running: diamond-deps

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       650.18 µs/iter 653.92 µs    █
                    (634.46 µs … 715.79 µs) 687.04 µs    █▂ ▅▄
                    (456.00  b … 323.45 kb) 868.75  b ▁▁▁██▃██▆▃▃▂▂▂▂▂▁▁▁▁▁

Lattice                      995.51 µs/iter 988.79 µs   █
                      (972.29 µs … 1.14 ms)   1.08 ms   █▆
                    (973.70 kb …   2.26 mb)   1.60 mb ▁▁██▂▂▁▁▂▁▁▁▁▁▁▂▃▂▁▁▁

Alien                        588.28 µs/iter 587.79 µs       █
                    (566.58 µs … 682.75 µs) 622.25 µs       █▅
                    (504.00  b … 316.99 kb) 775.74  b ▁▁▁▁▂▁██▅▃▁▁▂▅▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■ 650.18 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 995.51 µs
                       Alien ┤ 588.28 µs
                             └                                            ┘

summary
  Alien
   1.11x faster than Preact
   1.69x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       307.97 µs/iter 308.25 µs     █
                    (294.79 µs … 454.38 µs) 336.88 µs     █▂▇
                    ( 15.09 kb … 596.63 kb)  56.52 kb ▂▁▁▂███▄▃▃▂▃▂▂▂▁▁▁▁▁▁

Lattice                      232.46 µs/iter 231.67 µs  █
                    (225.75 µs … 481.58 µs) 313.46 µs  █
                    (163.34 kb …   1.25 mb) 260.70 kb ▂█▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        292.06 µs/iter 292.67 µs  █
                    (286.63 µs … 432.21 µs) 316.83 µs  █
                    ( 18.68 kb … 503.09 kb)  56.60 kb ▁███▃▂▂▆▂▂▁▁▁▂▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 307.97 µs
                     Lattice ┤ 232.46 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■ 292.06 µs
                             └                                            ┘

summary
  Lattice
   1.26x faster than Alien
   1.32x faster than Preact

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       730.00 µs/iter 731.13 µs         █
                    (704.67 µs … 800.88 µs) 766.67 µs        ▇█▂
                    (488.00  b … 938.91 kb)   1.64 kb ▁▂▁▁▁▁▁███▃▂▂▁▁▂▁▁▁▁▁

Lattice                      861.53 µs/iter 856.71 µs     █
                      (823.67 µs … 1.04 ms) 964.63 µs    ▅█
                    (902.20 kb …   3.37 mb)   1.60 mb ▁▁▁██▅▃▂▁▁▁▁▁▁▂▃▂▁▁▁▁

Alien                        611.45 µs/iter 609.71 µs    █▅
                    (588.42 µs … 755.04 µs) 701.67 µs    ██
                    (208.13 kb …   1.04 mb) 392.76 kb ▁▁▂██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■ 730.00 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 861.53 µs
                       Alien ┤ 611.45 µs
                             └                                            ┘

summary
  Alien
   1.19x faster than Preact
   1.41x faster than Lattice
  ✓ Completed in 10.83s

Running: effect-triggers

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       320.48 µs/iter 324.38 µs      █ ▂
                    (283.42 µs … 569.75 µs) 400.92 µs      █▄█
                    (632.00  b …   1.98 mb) 157.30 kb ▂▁▁▁▁███▃▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                      374.63 µs/iter 374.42 µs       █
                    (331.88 µs … 530.63 µs) 458.29 µs       █▃
                    (504.00  b … 604.24 kb) 155.10 kb ▁▁▁▁▁▁██▃▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        268.56 µs/iter 268.71 µs      █
                    (233.29 µs … 509.08 µs) 353.63 µs      █
                    (504.00  b …   2.43 mb) 157.77 kb ▁▁▁▁▂█▃▂▁▃▄▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■ 320.48 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 374.63 µs
                       Alien ┤ 268.56 µs
                             └                                            ┘

summary
  Alien
   1.19x faster than Preact
   1.39x faster than Lattice

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          213.99 µs/iter 213.29 µs     ▅█
                    (204.21 µs … 412.17 µs) 237.67 µs     ██
                    (120.00  b …   2.07 mb)   2.11 kb ▁▁▂▁██▂▄▅▂▁▂▂▂▁▁▁▁▁▁▁

Lattice - 10 effects         303.31 µs/iter 305.08 µs         █
                    (280.00 µs … 656.58 µs) 336.88 µs         █
                    (120.00  b … 512.40 kb)   2.36 kb ▂▁▂▃▂▂▅▇█▆▃▇▂▂▂▁▁▁▁▁▁

Alien - 10 effects           223.85 µs/iter 225.75 µs     █
                    (214.00 µs … 305.46 µs) 249.00 µs     █
                    (120.00  b … 720.36 kb)   1.72 kb ▁▁▂▂█▆▄▃▅▂▂▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤ 213.99 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 303.31 µs
          Alien - 10 effects ┤■■■■ 223.85 µs
                             └                                            ┘

summary
  Preact - 10 effects
   1.05x faster than Alien - 10 effects
   1.42x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         7.57 µs/iter   7.42 µs     █▃
                      (7.00 µs … 163.29 µs)   8.58 µs     ██
                    (  4.21 kb … 596.27 kb)  20.61 kb ▁▁▂▇██▆▄▃▂▁▁▁▁▁▁▁▁▁▁▁

Lattice                       11.74 µs/iter   8.04 µs  █
                        (7.38 µs … 2.69 ms)  18.54 µs  █
                    (  4.02 kb … 447.18 kb)  23.81 kb ▂█▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          5.69 µs/iter   5.70 µs    █ █ ▂     █
                        (5.65 µs … 5.78 µs)   5.74 µs ▅  █ █▅█▅    █
                    (690.41  b …   3.53 kb)   2.96 kb █▇▁█▇████▁▇▁▁█▁▁▁▁▇▁▇

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■ 7.57 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 11.74 µs
                       Alien ┤ 5.69 µs
                             └                                            ┘

summary
  Alien
   1.33x faster than Preact
   2.06x faster than Lattice
  ✓ Completed in 10.88s

Running: filtered-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        299.27 µs/iter 313.79 µs    █
                    (277.17 µs … 536.17 µs) 345.08 µs   ▅█
                    (120.00  b … 544.40 kb)   1.52 kb ▃▂██▅▇▃▂▂▂▂▇▂▂█▄▂▂▁▁▁

Lattice - 90% filtered       486.54 µs/iter 483.54 µs  █
                    (474.50 µs … 644.88 µs) 574.79 µs  █
                    ( 85.59 kb …   1.04 mb) 625.92 kb ▁█▇▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien - 90% filtered         297.22 µs/iter 293.67 µs   █
                    (273.38 µs … 401.54 µs) 364.71 µs   █
                    ( 48.00  b … 480.40 kb)   1.47 kb ▁▂█▃█▃▂▂▁▁▁▁▁▁▁▁▁▁▇▁▁

                             ┌                                            ┐
       Preact - 90% filtered ┤ 299.27 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 486.54 µs
        Alien - 90% filtered ┤ 297.22 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1.01x faster than Preact - 90% filtered
   1.64x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       836.76 µs/iter 835.33 µs     █
                      (804.54 µs … 1.02 ms) 950.46 µs    ██
                    (234.87 kb … 237.93 kb) 234.87 kb ▂▁▁██▅▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter        1.09 ms/iter   1.08 ms   ▇█
                        (1.06 ms … 1.24 ms)   1.18 ms   ██
                    (842.51 kb …   2.08 mb)   1.45 mb ▁▄███▄▂▄▂▂▂▁▁▁▂▃▂▂▁▁▁

Alien - toggle filter        757.98 µs/iter 755.17 µs   █
                    (742.17 µs … 894.96 µs) 851.63 µs   █
                    (196.15 kb … 552.37 kb) 235.18 kb ▁▇█▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■■ 836.76 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.09 ms
       Alien - toggle filter ┤ 757.98 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.1x faster than Preact - toggle filter
   1.43x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       409.24 µs/iter 413.29 µs     █
                    (392.71 µs … 465.88 µs) 452.71 µs    ▄█
                    (408.00  b … 288.49 kb) 951.04  b ▁▁▂███▃▇▅▂▂▂▂▂▁▁▁▁▂▁▁

Lattice                      701.58 µs/iter 701.63 µs   █
                    (678.25 µs … 913.25 µs) 793.21 µs   █▃
                    (386.61 kb …   1.83 mb)   1.22 mb ▁▆███▄▂▂▂▁▁▁▁▁▂▂▂▁▁▁▁

Alien                        420.78 µs/iter 420.17 µs   █
                    (412.08 µs … 531.96 µs) 455.42 µs   █
                    (504.00  b … 320.99 kb) 880.01  b ▁▁█▅▇▃▂▄▂▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 409.24 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 701.58 µs
                       Alien ┤■ 420.78 µs
                             └                                            ┘

summary
  Preact
   1.03x faster than Alien
   1.71x faster than Lattice
  ✓ Completed in 10.84s

Running: scaling-subscribers

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       17.13 µs/iter  16.25 µs  █
                      (14.88 µs … 46.33 µs)  34.17 µs ██▂▁▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.46 ms …   2.80 ms)   6.92 kb (456.00  b…445.88 kb)

Preact - 50 subscribers       28.93 µs/iter  27.75 µs █
                      (27.29 µs … 77.38 µs)  45.21 µs █▄▁▁▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   3.01 ms)  11.30 kb (456.00  b…489.28 kb)

Preact - 100 subscribers      51.61 µs/iter  51.88 µs           ▃█   ▃
                      (50.31 µs … 52.57 µs)  52.46 µs ▆▁▁▁▁▁▁▁▁▆██▁▆▁█▁▁▁▁▆
                  gc(  2.48 ms …   2.93 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     111.87 µs/iter 115.13 µs  █▄            ▅
                    (107.21 µs … 131.42 µs) 118.50 µs ▅██▂▄▃▄▃▅▃▅▄▆▅▇█▆▁▁▁▁
                  gc(  1.39 ms …   2.97 ms)  20.74 kb (456.00  b…156.95 kb)

Preact - 400 subscribers     338.58 µs/iter 341.79 µs   █▇▃
                    (303.21 µs … 903.50 µs) 476.42 µs ▂▅████▄▂▂▁▁▁▂▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   6.56 ms)   9.78 kb (456.00  b…136.45 kb)

Lattice - 25 subscribers      17.95 µs/iter  17.33 µs █▄
                      (15.88 µs … 64.50 µs)  37.58 µs ██▄▃▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.52 ms …   3.41 ms)  18.01 kb (  3.90 kb…284.90 kb)

Lattice - 50 subscribers      36.12 µs/iter  34.04 µs █
                     (33.33 µs … 137.75 µs) 122.25 µs █▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.48 ms …   3.11 ms)  37.63 kb (120.00  b…504.80 kb)

Lattice - 100 subscribers     66.08 µs/iter  66.13 µs   ▆█▂
                      (65.42 µs … 70.71 µs)  68.63 µs ▂▄███▆▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.55 ms …   2.99 ms)  60.24 kb ( 36.24 kb…181.24 kb)

Lattice - 200 subscribers    137.79 µs/iter 140.71 µs  █    ▂  ▇
                    (131.46 µs … 153.88 µs) 152.25 µs ▅█▂▄▄▇████▇▃▂▁▁▁▁▁▁▁▁
                  gc(  1.54 ms …   2.98 ms) 135.29 kb ( 67.99 kb…269.49 kb)

Lattice - 400 subscribers    341.39 µs/iter 350.92 µs    ▅█▆▂  ▂
                    (313.54 µs … 417.00 µs) 405.04 µs ▃▄▇███████▄▄▃▄▁▂▂▁▁▁▁
                  gc(  1.41 ms …   2.32 ms) 176.17 kb ( 82.12 kb…276.95 kb)

Alien - 25 subscribers        14.79 µs/iter  14.50 µs ▃█
                      (12.88 µs … 55.96 µs)  33.54 µs ██▄▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.58 ms …   2.80 ms)   6.09 kb (504.00  b…109.32 kb)

Alien - 50 subscribers        25.32 µs/iter  25.33 µs                █
                      (25.22 µs … 25.43 µs)  25.36 µs █▁▁▁▁█▁▁▁▁▁██▁▁██▁▁▁█
                  gc(  2.28 ms …   3.88 ms)  21.17  b (  0.10  b…263.52  b)

Alien - 100 subscribers       51.32 µs/iter  50.70 µs   █
                      (50.11 µs … 60.01 µs)  51.36 µs █▁█████▁██▁▁▁▁█▁▁▁▁▁█
                  gc(  2.55 ms …   3.90 ms)   0.11  b (  0.10  b…  0.12  b)

Alien - 200 subscribers      111.96 µs/iter 111.63 µs   ▅█
                    (104.96 µs … 185.63 µs) 149.79 µs ▂▅██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms … 123.14 ms)   9.62 kb (504.00  b…124.99 kb)

Alien - 400 subscribers      323.22 µs/iter 326.88 µs     ▃▇█
                    (299.63 µs … 393.67 µs) 377.00 µs ▁▃▅▇████▇▃▃▂▂▁▁▁▂▁▁▂▁
                  gc(  1.46 ms …   2.82 ms)   7.68 kb (504.00  b…136.99 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 17.13 µs
     Preact - 50 subscribers ┤■ 28.93 µs
    Preact - 100 subscribers ┤■■■■ 51.61 µs
    Preact - 200 subscribers ┤■■■■■■■■■■ 111.87 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 338.58 µs
    Lattice - 25 subscribers ┤ 17.95 µs
    Lattice - 50 subscribers ┤■■ 36.12 µs
   Lattice - 100 subscribers ┤■■■■■ 66.08 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■■■ 137.79 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 341.39 µs
      Alien - 25 subscribers ┤ 14.79 µs
      Alien - 50 subscribers ┤■ 25.32 µs
     Alien - 100 subscribers ┤■■■■ 51.32 µs
     Alien - 200 subscribers ┤■■■■■■■■■■ 111.96 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 323.22 µs
                             └                                            ┘

summary
  Alien - $sources subscribers
   +1.05…+1.16x faster than Preact - $sources subscribers
   +1.06…+1.21x faster than Lattice - $sources subscribers
  ✓ Completed in 32.92s

Running: signal-updates

clk: ~3.02 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          357.77 µs/iter 329.92 µs  █
                    (308.83 µs … 613.42 µs) 587.46 µs  █
                    (408.00  b … 358.23 kb)   1.08 kb ▂█▅▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▃▂

Lattice - write only         236.65 µs/iter 415.38 µs █
                     (94.67 µs … 490.79 µs) 470.04 µs █                ▂
                    (120.00  b … 557.40 kb)   1.36 kb █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▄█▁▃▃

Alien - write only            72.99 µs/iter  48.17 µs █
                     (45.38 µs … 598.08 µs) 575.33 µs █
                    ( 48.00  b … 685.40 kb) 486.46  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           246.39 µs/iter 414.00 µs █
                     (94.71 µs … 493.00 µs) 443.50 µs █                 ▄▂
                    ( 48.00  b … 600.40 kb)   1.13 kb █▁▁▁▁▁▁▂▇▁▁▁▁▁▁▁▁▁██▁

Lattice - read only          216.51 µs/iter 405.54 µs █
                     (38.54 µs … 476.33 µs) 437.50 µs █                 ▅
                    ( 48.00  b … 429.40 kb)   1.13 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██▂

Alien - read only             94.36 µs/iter  62.17 µs █
                     (59.17 µs … 618.00 µs) 587.13 µs █
                    ( 32.00  b … 781.40 kb) 544.71  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    384.29 µs/iter 347.46 µs  █
                    (325.58 µs … 906.75 µs) 881.58 µs ▂█
                    (408.00  b … 288.49 kb) 919.25  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂▂

Lattice - read/write mixed   311.06 µs/iter 751.38 µs █
                     (95.75 µs … 831.08 µs) 811.04 µs █
                    ( 48.00  b … 632.90 kb)   1.36 kb █▁▁▁▁▁▃▇▁▁▁▁▁▁▁▁▁▁▃▇▃

Alien - read/write mixed     350.60 µs/iter 214.38 µs █
                      (126.33 µs … 1.49 ms)   1.46 ms █
                    (408.00  b … 160.49 kb) 681.14  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃▄

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 357.77 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 236.65 µs
          Alien - write only ┤ 72.99 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■■ 246.39 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 216.51 µs
           Alien - read only ┤■■ 94.36 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 384.29 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 311.06 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 350.60 µs
                             └                                            ┘

summary
  Alien - write only
   1.29x faster than Alien - read only
   2.97x faster than Lattice - read only
   3.24x faster than Lattice - write only
   3.38x faster than Preact - read only
   4.26x faster than Lattice - read/write mixed
   4.8x faster than Alien - read/write mixed
   4.9x faster than Preact - write only
   5.26x faster than Preact - read/write mixed
  ✓ Completed in 10.86s

Running: sparse-updates

clk: ~3.05 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   38.01 µs/iter  36.38 µs █▄
                     (35.04 µs … 120.83 µs)  72.88 µs ██▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.41 ms …   3.04 ms)  14.46 kb (456.00  b…487.56 kb)

Preact - 15% sparse updates   45.45 µs/iter  44.29 µs █
                      (43.58 µs … 75.46 µs)  71.42 µs █▃▁▁▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.50 ms …   3.43 ms)   8.63 kb (456.00  b…290.27 kb)

Preact - 20% sparse updates   57.07 µs/iter  57.40 µs           █ ▃
                      (55.41 µs … 58.60 µs)  58.52 µs ▆▁▁▆▆▁▁▁▁▁█▁█▆▁▆▁▁▁▁▆
                  gc(  2.52 ms …   4.12 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   77.11 µs/iter  76.67 µs █
                     (72.21 µs … 193.42 µs) 138.83 µs █▆▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   5.04 ms)   4.20 kb (440.00  b… 60.95 kb)

Lattice - 10% sparse updates  39.65 µs/iter  38.00 µs █
                     (36.79 µs … 132.38 µs)  82.29 µs █▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.42 ms …   3.13 ms)  42.50 kb (  3.24 kb…  1.47 mb)

Lattice - 15% sparse updates  57.13 µs/iter  56.54 µs ▅█
                     (54.67 µs … 123.75 µs)  79.75 µs ██▅▂▁▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.44 ms …   2.72 ms)  57.62 kb ( 24.96 kb…173.46 kb)

Lattice - 20% sparse updates  74.28 µs/iter  74.04 µs █▇
                     (72.54 µs … 114.58 µs)  97.21 µs ██▅▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.92 ms)  68.18 kb ( 34.49 kb…187.49 kb)

Lattice - 25% sparse updates  91.48 µs/iter  91.42 µs  █▆
                     (90.50 µs … 117.75 µs)  98.08 µs ▃██▆▂▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   2.83 ms)  89.93 kb ( 58.12 kb…203.12 kb)

Alien - 10% sparse updates    31.05 µs/iter  30.08 µs █
                      (29.46 µs … 88.04 µs)  64.50 µs █▂▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   2.94 ms)   8.28 kb (456.00  b…288.66 kb)

Alien - 15% sparse updates    44.73 µs/iter  44.75 µs  ▇▆█
                      (44.25 µs … 52.13 µs)  47.17 µs ▄███▆▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   2.84 ms)   5.08 kb (456.00  b…124.95 kb)

Alien - 20% sparse updates    56.26 µs/iter  56.36 µs      ███
                      (55.72 µs … 57.02 µs)  56.99 µs █▁▁▁████▁▁█▁█▁▁▁▁▁▁▁█
                  gc(  2.50 ms …   3.85 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    77.03 µs/iter  77.83 µs        ▆█▄
                      (73.46 µs … 91.58 µs)  83.38 µs ▆█▄▂▂▃▇███▄▃▂▂▃▂▂▂▂▁▁
                  gc(  1.41 ms …   2.77 ms)  10.75 kb (456.00  b…132.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■■■ 38.01 µs
 Preact - 15% sparse updates ┤■■■■■■■■ 45.45 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■■■ 57.07 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 77.11 µs
Lattice - 10% sparse updates ┤■■■■■ 39.65 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■■■ 57.13 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■ 74.28 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 91.48 µs
  Alien - 10% sparse updates ┤ 31.05 µs
  Alien - 15% sparse updates ┤■■■■■■■■ 44.73 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■■■ 56.26 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 77.03 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   1…+1.22x faster than Preact - $changeRatio% sparse updates
   +1.19…+1.28x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 28.43s

Running: wide-fanout

clk: ~2.95 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       308.05 µs/iter 308.25 µs █
                    (304.13 µs … 470.21 µs) 334.13 µs █▆ ▄
                    ( 54.80 kb … 567.09 kb)  56.83 kb ████▃▃▁▃▂▂▂▂▁▁▁▁▁▁▁▁▁

Lattice                      226.04 µs/iter 224.58 µs  █
                    (216.04 µs … 421.50 µs) 308.42 µs  ██
                    ( 43.28 kb … 842.35 kb) 260.09 kb ▁██▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        296.28 µs/iter 296.00 µs   █
                    (288.21 µs … 449.13 µs) 325.88 µs   █
                    ( 15.09 kb … 628.18 kb)  56.85 kb ▁▄██▂▁▁▂▄▃▂▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 308.05 µs
                     Lattice ┤ 226.04 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 296.28 µs
                             └                                            ┘

summary
  Lattice
   1.31x faster than Alien
   1.36x faster than Preact

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       364.84 µs/iter 363.83 µs   █
                    (356.33 µs … 630.92 µs) 394.96 µs   █
                    (  5.87 kb …   1.66 mb)   8.00 kb ▂▁█▄▇▂▂▂▂▂▂▁▁▂▁▁▁▁▁▁▁

Lattice                      176.99 µs/iter 176.08 µs   █
                    (170.50 µs … 369.25 µs) 228.58 µs  ▇█
                    ( 13.90 kb … 550.33 kb)  28.09 kb ▁██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        300.20 µs/iter 304.08 µs ▂█
                    (293.92 µs … 388.67 µs) 353.67 µs ██
                    (  5.52 kb … 549.87 kb)   8.08 kb ██▅██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 364.84 µs
                     Lattice ┤ 176.99 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■ 300.20 µs
                             └                                            ┘

summary
  Lattice
   1.7x faster than Alien
   2.06x faster than Preact

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       259.70 µs/iter 259.17 µs     █
                    (248.37 µs … 356.00 µs) 288.92 µs     █
                    (  5.59 kb … 621.20 kb)   7.31 kb ▁▁▂▁██▃▂▃▂▂▂▁▁▁▁▁▁▁▁▁

Lattice                       87.67 µs/iter  86.50 µs  █
                     (83.58 µs … 235.88 µs) 122.25 µs  █
                    (  2.83 kb … 575.77 kb)  40.00 kb ▁█▅▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        271.81 µs/iter 274.83 µs  █
                    (264.25 µs … 342.79 µs) 305.54 µs  █
                    (  2.96 kb … 432.96 kb)   7.56 kb ▁█▆▄▆▄▃▂▇▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 259.70 µs
                     Lattice ┤ 87.67 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 271.81 µs
                             └                                            ┘

summary
  Lattice
   2.96x faster than Preact
   3.1x faster than Alien
  ✓ Completed in 10.83s

Running: write-heavy

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        54.98 µs/iter  54.50 µs    █
                     (52.42 µs … 138.58 µs)  64.13 µs    █
                    ( 32.00  b … 978.71 kb) 927.23  b ▁▁▂█▅▁▂▁▂▁▁▁▁▁▁▂▁▁▁▁▁

Lattice                      142.16 µs/iter 140.75 µs   █
                    (138.21 µs … 313.50 µs) 158.71 µs   █
                    (  1.40 kb … 448.99 kb)  14.30 kb ▁▁█▂▂▂▁▁▁▁▁▁▃▂▁▁▁▁▁▁▁

Alien                         45.89 µs/iter  44.42 µs  █
                     (43.00 µs … 120.75 µs)  84.08 µs  █
                    ( 32.00  b …   1.53 mb) 737.26  b ▁█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 54.98 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 142.16 µs
                       Alien ┤ 45.89 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   3.1x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        48.95 µs/iter  48.46 µs    █
                     (46.83 µs … 122.54 µs)  57.46 µs    █
                    ( 32.00  b … 220.99 kb) 833.42  b ▁▁▄█▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      133.79 µs/iter 134.25 µs   █
                    (130.21 µs … 180.00 µs) 149.42 µs   █
                    (  1.30 kb … 666.24 kb)   3.36 kb ▁▁█▃▂▃▃▁▁▁▁▁▂▂▁▁▁▁▁▁▁

Alien                         40.03 µs/iter  39.00 µs  █
                     (37.75 µs … 102.96 µs)  77.79 µs  █
                    ( 48.00  b … 502.49 kb) 513.48  b ▂█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■ 48.95 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 133.79 µs
                       Alien ┤ 40.03 µs
                             └                                            ┘

summary
  Alien
   1.22x faster than Preact
   3.34x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        95.22 µs/iter  96.50 µs    █
                     (91.54 µs … 249.88 µs) 104.67 µs    █▂   ▂
                    (  1.37 kb … 491.46 kb)   6.89 kb ▁▁▂██▂▂▄█▄▁▁▁▁▂▁▁▁▁▁▁

Lattice                      178.33 µs/iter 186.33 µs  ▅       █
                    (151.71 µs … 345.63 µs) 228.21 µs  █       █
                    ( 21.46 kb … 502.46 kb)  69.33 kb ▁█▅▃▂▁▁▁▁█▆▂▁▁▁▁▁▅▂▁▁

Alien                        136.83 µs/iter 138.25 µs    █
                    (130.67 µs … 241.58 µs) 154.08 µs    █
                    (  5.50 kb …   1.08 mb)   7.02 kb ▁▁▂█▅▂▄▆▁▁▃▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 95.22 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 178.33 µs
                       Alien ┤■■■■■■■■■■■■■■■■■ 136.83 µs
                             └                                            ┘

summary
  Preact
   1.44x faster than Alien
   1.87x faster than Lattice
  ✓ Completed in 10.80s

Summary:
  Total: 12
  Success: 12
  Failed: 0