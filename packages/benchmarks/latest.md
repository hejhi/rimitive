Found 12 benchmark suites

Running: batch-operations

clk: ~2.90 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Batch 3 Signal Updates
------------------------------------------- -------------------------------
Preact                       575.63 µs/iter 563.79 µs  █
                      (526.79 µs … 2.11 ms)   1.07 ms  █
                    ( 10.85 kb …   1.26 mb) 937.38 kb ██▅▂▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      517.32 µs/iter 518.33 µs   █
                    (490.88 µs … 698.08 µs) 627.79 µs   █▆▄
                    (642.13 kb …   1.21 mb) 938.45 kb ▁▄███▅▃▂▂▁▁▁▁▁▂▁▂▁▁▁▁

Alien                        440.32 µs/iter 446.04 µs        █    ▄
                    (411.75 µs … 584.50 µs) 468.96 µs        █ ▃  █
                    (456.00  b … 377.99 kb) 969.19  b ▂▂▁▂▂▁▄█▇█▇██▄▇▃▂▂▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 575.63 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■ 517.32 µs
                       Alien ┤ 440.32 µs
                             └                                            ┘

summary
  Alien
   1.17x faster than Lattice
   1.31x faster than Preact

• Batch 10 Signal Updates
------------------------------------------- -------------------------------
Preact                       134.51 µs/iter 135.04 µs  █▃
                    (127.54 µs … 299.42 µs) 212.96 µs  ██
                    ( 36.12 kb … 788.16 kb) 204.56 kb ▅██▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      187.04 µs/iter 187.50 µs     █
                    (159.88 µs … 446.04 µs) 267.46 µs     █▇
                    ( 55.06 kb … 753.66 kb) 204.75 kb ▁▁▁▁██▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        221.35 µs/iter 221.63 µs    █
                    (206.75 µs … 381.21 µs) 293.92 µs   ▂█
                    ( 17.43 kb … 634.97 kb) 149.82 kb ▁▂██▆▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 134.51 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■ 187.04 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 221.35 µs
                             └                                            ┘

summary
  Preact
   1.39x faster than Lattice
   1.65x faster than Alien

• Nested Batch Operations
------------------------------------------- -------------------------------
Preact                       416.74 µs/iter 416.63 µs    █
                    (391.21 µs … 632.00 µs) 529.71 µs   ▃█▆
                    ( 42.59 kb …   1.01 mb) 516.41 kb ▁▆███▃▂▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                      510.89 µs/iter 513.25 µs    █
                    (479.21 µs … 835.67 µs) 631.46 µs    █▂
                    ( 67.07 kb …   1.54 mb) 518.48 kb ▁▂▅███▄▂▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        433.82 µs/iter 434.83 µs      ▇█
                    (411.88 µs … 593.79 µs) 490.25 µs      ██
                    ( 27.40 kb … 693.87 kb) 110.87 kb ▂▁▂▄▇██▄▂▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 416.74 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 510.89 µs
                       Alien ┤■■■■■■ 433.82 µs
                             └                                            ┘

summary
  Preact
   1.04x faster than Alien
   1.23x faster than Lattice
  ✓ Completed in 10.93s

Running: computed-chains

clk: ~2.99 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Computed Chain - Short (3 levels)
------------------------------------------- -------------------------------
Preact                       410.11 µs/iter 417.71 µs       ▇█
                    (384.83 µs … 454.00 µs) 442.04 µs      ▂██
                    (408.00  b … 256.45 kb) 812.20  b ▁▂▂▃▄████▇█▇█▇▄▄▄▃▂▂▁

Lattice                      470.31 µs/iter 477.17 µs       █
                    (442.46 µs … 531.00 µs) 506.79 µs       █
                    (504.00  b … 284.99 kb) 914.68  b ▁▁▁▂▂▄█▅▆▄▄▄▄▃▃▃▂▂▂▁▁

Alien                        369.98 µs/iter 368.63 µs    █
                    (340.25 µs … 477.25 µs) 461.04 µs    █
                    (408.00  b … 287.49 kb) 941.98  b ▁▂▂█▄▃▃▂▂▁▁▁▁▁▁▂▃▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■ 410.11 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 470.31 µs
                       Alien ┤ 369.98 µs
                             └                                            ┘

summary
  Alien
   1.11x faster than Preact
   1.27x faster than Lattice

• Computed Chain - Deep (10 levels)
------------------------------------------- -------------------------------
Preact                       198.96 µs/iter 200.46 µs    ▄  █▃
                    (188.42 µs … 240.50 µs) 221.33 µs   ▃█  ██
                    (120.00  b … 354.90 kb)   1.22 kb ▁▂██▆▄██▅▅▅▄▃▃▂▂▂▂▁▁▁

Lattice                      231.07 µs/iter 232.58 µs     ██
                    (218.42 µs … 281.13 µs) 257.08 µs     ██▆
                    ( 48.00  b … 576.40 kb)   1.62 kb ▁▁▄▃███▇▅▄▄▃▄▂▂▂▂▂▁▁▁

Alien                        227.90 µs/iter 231.50 µs      ▇█
                    (211.92 µs … 285.83 µs) 255.17 µs      ██  ▃
                    ( 32.00  b … 384.40 kb)   1.62 kb ▂▁▂▄██████▇▅▃▃▂▂▂▁▂▁▁

                             ┌                                            ┐
                      Preact ┤ 198.96 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 231.07 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 227.90 µs
                             └                                            ┘

summary
  Preact
   1.15x faster than Alien
   1.16x faster than Lattice

• Computed Chain - Very Deep (50 levels)
------------------------------------------- -------------------------------
Preact                       114.41 µs/iter 116.67 µs     █▂
                    (104.92 µs … 263.92 µs) 135.08 µs    ▂██ ▃▃
                    (120.00  b … 801.49 kb)   1.11 kb ▁▃▄███▅██▄▅▅▃▂▂▁▁▁▁▁▁

Lattice                      114.46 µs/iter 114.33 µs    █▆
                    (109.00 µs … 479.13 µs) 130.58 µs    ██
                    ( 48.00  b … 750.70 kb)   1.30 kb ▁▅████▄▄▄▃▂▂▂▂▁▂▁▁▁▁▁

Alien                        108.28 µs/iter 108.71 µs     ▇█
                    (101.38 µs … 143.17 µs) 123.88 µs     ██
                    ( 32.00  b … 259.40 kb) 806.75  b ▁▁▂▆███▃▅▄▃▃▃▃▂▂▂▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 114.41 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 114.46 µs
                       Alien ┤ 108.28 µs
                             └                                            ┘

summary
  Alien
   1.06x faster than Preact
   1.06x faster than Lattice
  ✓ Completed in 10.90s

Running: conditional-deps

clk: ~2.98 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Conditional
------------------------------------------- -------------------------------
Preact                       604.33 µs/iter 606.92 µs    █
                    (561.25 µs … 860.13 µs) 740.71 µs    █▄█
                    (301.23 kb …   1.32 mb) 859.93 kb ▁▃▂███▄▃▂▁▁▁▂▁▁▂▁▁▁▁▁

Lattice                      457.36 µs/iter 461.29 µs       █▂ ▂
                    (428.63 µs … 525.67 µs) 500.21 µs      ███▇█
                    (488.00  b … 613.99 kb)   1.08 kb ▁▁▂▁▅██████▅▄▃▂▂▂▂▂▁▁

Alien                          1.03 ms/iter 584.79 µs █
                     (538.63 µs … 13.18 ms)  12.04 ms █
                    (220.57 kb …   1.06 mb) 702.07 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■ 604.33 µs
                     Lattice ┤ 457.36 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.03 ms
                             └                                            ┘

summary
  Lattice
   1.32x faster than Preact
   2.25x faster than Alien

• Nested Conditional
------------------------------------------- -------------------------------
Preact                       937.37 µs/iter 944.29 µs     █
                      (873.83 µs … 1.13 ms)   1.08 ms     █
                    (370.52 kb …   1.32 mb) 860.33 kb ▁▁▁▁█▆▄█▃▃▂▂▂▁▁▂▁▁▁▁▁

Lattice                      920.08 µs/iter 921.96 µs          █
                      (871.42 µs … 1.00 ms) 961.33 µs          █▅
                    (504.00  b …   1.23 mb)   2.97 kb ▁▁▁▁▂▁▁▁▁███▃▂▃▄▄▂▂▁▁

Alien                          1.27 ms/iter 853.17 µs █
                     (806.04 µs … 11.95 ms)  11.73 ms █
                    (297.75 kb …   1.09 mb) 702.89 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■ 937.37 µs
                     Lattice ┤ 920.08 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.27 ms
                             └                                            ┘

summary
  Lattice
   1.02x faster than Preact
   1.38x faster than Alien
  ✓ Completed in 8.74s

Running: dense-updates

clk: ~2.99 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Dense Updates (50-100% change rate)
------------------------------------------- -------------------------------
Preact - 50% dense updates   175.68 µs/iter 179.37 µs  ▃█▂
                    (160.29 µs … 361.88 µs) 232.92 µs ▄████▅▃▃▄▂▃▂▂▂▁▁▁▁▁▁▁
                  gc(  1.63 ms …   4.72 ms)  14.95 kb (456.00  b…  1.39 mb)

Preact - 75% dense updates   262.55 µs/iter 268.92 µs  ▃▂▅▆▃▅█▃
                    (240.71 µs … 401.67 µs) 302.25 µs ▄████████▇▇▄▃▄▄▅▃▄▂▂▂
                  gc(  1.48 ms …   2.95 ms)  20.35 kb (456.00  b…887.90 kb)

Preact - 90% dense updates   301.40 µs/iter 311.21 µs  ▇  ▄▂▄█▆▆▃
                    (274.38 µs … 353.79 µs) 344.79 µs ▄█▆▇██████████▄▂▄▂▂▂▂
                  gc(  1.42 ms …   2.92 ms)   7.11 kb (456.00  b…136.45 kb)

Preact - 100% dense updates  322.58 µs/iter 332.71 µs  ▄    ▆█▃▃ ▂
                    (295.63 µs … 360.75 µs) 356.83 µs ▇█▄▂▄▅██████▇▅▅▇▆▄▄▃▂
                  gc(  1.44 ms …   3.14 ms)   6.30 kb (456.00  b… 72.45 kb)

Lattice - 50% dense updates  158.39 µs/iter 159.88 µs  █
                    (148.96 µs … 283.54 µs) 195.25 µs ▇█▃▆▂▂▂▂▁▂▂▂▂▂▁▁▂▂▁▁▁
                  gc(  1.62 ms …   4.21 ms)  39.02 kb (504.00  b…  2.19 mb)

Lattice - 75% dense updates  241.43 µs/iter 249.46 µs █▂
                    (222.50 µs … 306.08 µs) 288.50 µs ██▇▅▅▆█▇▅▄▃▃▄▃▃▂▂▃▂▂▁
                  gc(  1.60 ms …   2.97 ms)  29.69 kb (504.00  b…287.27 kb)

Lattice - 90% dense updates  289.51 µs/iter 299.42 µs  █  ▅ ▂  ▂
                    (265.75 µs … 334.92 µs) 328.33 µs ▃█▃▃█▄█▆▇██▇▆▄▃▂▃▂▄▃▂
                  gc(  1.53 ms …   2.40 ms)   4.75 kb (504.00  b…116.49 kb)

Lattice - 100% dense updates 331.35 µs/iter 341.75 µs       █▄▅▃▅▆▃
                    (299.33 µs … 370.58 µs) 366.63 µs ▃█▅▃▅█████████▇█▅▇▃▃▂
                  gc(  1.50 ms …   2.94 ms)   4.68 kb (504.00  b… 85.99 kb)

Alien - 50% dense updates    161.48 µs/iter 167.38 µs  █
                    (144.79 µs … 322.92 µs) 216.63 µs ▄██▇▅▃▃▂▂▃▂▂▁▂▁▁▁▁▂▂▁
                  gc(  1.64 ms …   4.75 ms)  35.49 kb (456.00  b…  1.09 mb)

Alien - 75% dense updates    230.37 µs/iter 240.21 µs  █
                    (213.08 µs … 290.50 µs) 269.83 µs ▇█▆▄▄▄▃▄▆▄▄▃▃▃▂▃▂▃▂▂▂
                  gc(  1.52 ms …   2.29 ms)  25.01 kb (456.00  b…267.23 kb)

Alien - 90% dense updates    275.76 µs/iter 285.96 µs █▅     ▂▄
                    (254.29 µs … 319.33 µs) 315.33 µs ███▇▇▅█████▇▇▆▄▃▃▃▃▂▂
                  gc(  1.48 ms …   2.90 ms)   7.12 kb (456.00  b…122.95 kb)

Alien - 100% dense updates   311.73 µs/iter 322.50 µs  █    ▄█▅▂▂▃
                    (283.33 µs … 354.88 µs) 348.25 µs ▅█▅▂█▆█████████▅▄▆▃▄▂
                  gc(  1.48 ms …   2.87 ms)   8.31 kb (456.00  b… 99.95 kb)

                             ┌                                            ┐
  Preact - 50% dense updates ┤■■■ 175.68 µs
  Preact - 75% dense updates ┤■■■■■■■■■■■■■■■■■■■■ 262.55 µs
  Preact - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 301.40 µs
 Preact - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 322.58 µs
 Lattice - 50% dense updates ┤ 158.39 µs
 Lattice - 75% dense updates ┤■■■■■■■■■■■■■■■■ 241.43 µs
 Lattice - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 289.51 µs
Lattice - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 331.35 µs
   Alien - 50% dense updates ┤■ 161.48 µs
   Alien - 75% dense updates ┤■■■■■■■■■■■■■■ 230.37 µs
   Alien - 90% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■ 275.76 µs
  Alien - 100% dense updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 311.73 µs
                             └                                            ┘

summary
  Alien - $changeRatio% dense updates
   +1.06…-1.02x faster than Lattice - $changeRatio% dense updates
   +1.03…+1.09x faster than Preact - $changeRatio% dense updates
  ✓ Completed in 22.39s

Running: diamond-deps

clk: ~2.98 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Simple Diamond
------------------------------------------- -------------------------------
Preact                       661.56 µs/iter 670.46 µs      █
                    (635.83 µs … 715.67 µs) 701.17 µs    ▄▅█    ▆▃
                    (456.00  b … 201.71 kb) 766.27  b ▁▁▂████▅▅▆██▇▄▃▄▂▂▂▁▁

Lattice                      949.09 µs/iter 962.08 µs      █
                      (908.00 µs … 1.05 ms)   1.01 ms     ▄█ ▄  ▂▂
                    (504.00  b … 737.49 kb)   1.49 kb ▂▁▁▁████▅▄██▅▃▂▂▃▂▂▁▁

Alien                        607.82 µs/iter 616.13 µs      █
                    (578.75 µs … 695.96 µs) 645.58 µs      █     ▅
                    (504.00  b … 316.99 kb) 785.78  b ▁▁▁▁▁█▅▃▂▃▄█▅▃▂▂▂▂▂▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■ 661.56 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 949.09 µs
                       Alien ┤ 607.82 µs
                             └                                            ┘

summary
  Alien
   1.09x faster than Preact
   1.56x faster than Lattice

• Wide Diamond (10 paths)
------------------------------------------- -------------------------------
Preact                       344.13 µs/iter 348.04 µs     █   ▄
                    (325.63 µs … 541.71 µs) 372.92 µs     █   █▄▂
                    (  4.69 kb … 383.68 kb)  55.76 kb ▁▁▁▁██▆████▄█▃▂▁▁▁▁▁▁

Lattice                      470.39 µs/iter 476.08 µs     █
                    (448.33 µs … 654.21 µs) 517.25 µs     █   ▄
                    ( 55.18 kb … 879.68 kb)  56.56 kb ▁▁▁▂█▄▂▆█▄▂▁▂▁▁▁▁▁▁▁▁

Alien                        301.97 µs/iter 304.92 µs     █
                    (284.46 µs … 492.42 µs) 340.92 µs     █▄ ▅
                    ( 15.59 kb …   1.36 mb)  57.02 kb ▂▂▂███▇█▅▆▃▂▃▂▂▂▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■ 344.13 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 470.39 µs
                       Alien ┤ 301.97 µs
                             └                                            ┘

summary
  Alien
   1.14x faster than Preact
   1.56x faster than Lattice

• Nested Diamond
------------------------------------------- -------------------------------
Preact                       727.93 µs/iter 739.63 µs       ▆█      ▃
                    (695.33 µs … 803.33 µs) 761.71 µs       ███   ▆▆█
                    (504.00  b … 774.56 kb)   1.53 kb ▄▃▂▂▂▁███▄▃▅███▆▃▃▁▂▁

Lattice                        1.09 ms/iter   1.11 ms       █
                        (1.04 ms … 1.17 ms)   1.15 ms      ▅█     █▆
                    (456.00  b … 966.06 kb)   2.98 kb ▁▁▁▁▁██▇▄▃▅███▄▃▂▂▂▁▁

Alien                        637.97 µs/iter 643.63 µs   ▄  █
                    (602.63 µs … 792.71 µs) 752.17 µs   █▄ █
                    (391.12 kb …   1.73 mb) 394.36 kb ▁▂██▅██▇▃▂▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■ 727.93 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 1.09 ms
                       Alien ┤ 637.97 µs
                             └                                            ┘

summary
  Alien
   1.14x faster than Preact
   1.71x faster than Lattice
  ✓ Completed in 10.89s

Running: effect-triggers

clk: ~2.97 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Single Effect
------------------------------------------- -------------------------------
Preact                       326.75 µs/iter 331.17 µs       █
                    (284.17 µs … 584.17 µs) 410.33 µs       █
                    (744.00  b …   2.28 mb) 157.69 kb ▁▁▁▁▂▆██▄█▂▁▁▁▁▁▁▁▁▁▁

Lattice                      301.05 µs/iter 303.67 µs     █
                    (266.92 µs … 519.13 µs) 397.75 µs     ███
                    (248.00  b …   1.23 mb) 156.98 kb ▁▁▁▁███▂▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        276.94 µs/iter 276.75 µs       ▅█
                    (232.04 µs … 505.58 µs) 352.33 µs       ██
                    (504.00  b …   2.28 mb) 157.62 kb ▂▁▁▁▂▅██▄▂▄▃▆▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 326.75 µs
                     Lattice ┤■■■■■■■■■■■■■■■■ 301.05 µs
                       Alien ┤ 276.94 µs
                             └                                            ┘

summary
  Alien
   1.09x faster than Lattice
   1.18x faster than Preact

• Multiple Effects
------------------------------------------- -------------------------------
Preact - 10 effects          257.75 µs/iter 261.21 µs     █
                    (245.96 µs … 511.50 µs) 287.08 µs    ██▂▅ ▇
                    (120.00  b …   1.45 mb)   2.11 kb ▂▃▂████▇█▅▃▁▁▁▁▁▁▁▁▁▁

Lattice - 10 effects         263.12 µs/iter 267.08 µs    █
                    (250.58 µs … 404.25 µs) 287.13 µs    █▅   ▄▄
                    (120.00  b … 419.40 kb)   1.87 kb ▁▁▂██▅▆▇██▇▅▅▂▂▂▁▁▁▁▁

Alien - 10 effects           228.28 µs/iter 231.58 µs      █
                    (216.79 µs … 300.21 µs) 247.21 µs     ▄█▂  ▂
                    (120.00  b …   1.03 mb)   1.68 kb ▂▂▂▁███▆████▄▄▂▁▂▁▁▁▁

                             ┌                                            ┐
         Preact - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 257.75 µs
        Lattice - 10 effects ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 263.12 µs
          Alien - 10 effects ┤ 228.28 µs
                             └                                            ┘

summary
  Alien - 10 effects
   1.13x faster than Preact - 10 effects
   1.15x faster than Lattice - 10 effects

• Effect Cleanup
------------------------------------------- -------------------------------
Preact                         8.73 µs/iter   8.50 µs  ▇█
                      (7.92 µs … 195.54 µs)  13.75 µs  ██
                    (312.00  b … 624.28 kb)  20.63 kb ▂██▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                       11.42 µs/iter   7.29 µs ██
                        (6.67 µs … 2.91 ms)  18.46 µs ██
                    (584.00  b … 559.30 kb)  23.75 kb ██▄▃▂▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁

Alien                          6.58 µs/iter   6.38 µs  █▂
                      (5.92 µs … 182.13 µs)  11.17 µs  ██
                    (  3.16 kb … 365.07 kb)  19.76 kb ▃██▄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■■ 8.73 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 11.42 µs
                       Alien ┤ 6.58 µs
                             └                                            ┘

summary
  Alien
   1.33x faster than Preact
   1.74x faster than Lattice
  ✓ Completed in 10.98s

Running: filtered-updates

clk: ~2.98 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Threshold Filter
------------------------------------------- -------------------------------
Preact - 90% filtered        308.39 µs/iter 319.29 µs    ▇ █
                    (283.96 µs … 371.33 µs) 348.50 µs   ▆█ █▆█   ▅
                    (120.00  b … 541.90 kb)   1.78 kb ▁▂██████▄▃▂█▃▂▃▃▃▅█▆▂

Lattice - 90% filtered       399.60 µs/iter 405.79 µs      █
                    (381.67 µs … 449.67 µs) 427.42 µs      █     ▅
                    (408.00  b … 369.89 kb)   1.22 kb ▁▂▁▁██▆▅▄█▆█▄▂▂▂▂▂▁▁▁

Alien - 90% filtered         305.91 µs/iter 301.75 µs  █
                    (282.92 µs … 428.54 µs) 380.79 µs  █ ▆
                    ( 48.00  b … 480.40 kb)   1.50 kb ▂███▇▂▁▁▁▁▁▁▁▁▁▁▇▂▂▂▁

                             ┌                                            ┐
       Preact - 90% filtered ┤■ 308.39 µs
      Lattice - 90% filtered ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 399.60 µs
        Alien - 90% filtered ┤ 305.91 µs
                             └                                            ┘

summary
  Alien - 90% filtered
   1.01x faster than Preact - 90% filtered
   1.31x faster than Lattice - 90% filtered

• Boolean Filter
------------------------------------------- -------------------------------
Preact - toggle filter       850.37 µs/iter 847.00 µs   █
                      (827.21 µs … 1.04 ms) 960.96 µs   █▂
                    (164.99 kb … 568.82 kb) 235.19 kb ▁▁██▃▂▃▃▂▁▁▁▁▁▁▁▁▁▁▁▁

Lattice - toggle filter      976.74 µs/iter 983.71 µs     █
                      (930.88 µs … 1.14 ms)   1.08 ms     ██▅
                    (196.15 kb … 752.37 kb) 235.58 kb ▂▁▂▂███▆▇▄▃▃▂▂▁▁▁▁▁▁▁

Alien - toggle filter        783.24 µs/iter 795.00 µs    █
                    (748.46 µs … 953.71 µs) 898.21 µs    █
                    (214.37 kb … 552.37 kb) 235.54 kb ▂▂▁█▇▂▆▆▂▃▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
      Preact - toggle filter ┤■■■■■■■■■■■■ 850.37 µs
     Lattice - toggle filter ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 976.74 µs
       Alien - toggle filter ┤ 783.24 µs
                             └                                            ┘

summary
  Alien - toggle filter
   1.09x faster than Preact - toggle filter
   1.25x faster than Lattice - toggle filter

• Multi-Level Filter
------------------------------------------- -------------------------------
Preact                       420.08 µs/iter 424.71 µs      █     ▂
                    (398.83 µs … 526.00 µs) 446.25 µs      █    ▇█
                    (504.00  b … 527.90 kb)   1.28 kb ▂▂▂▁▄█▇▄▃███▆▅▃▃▃▂▁▁▁

Lattice                      565.35 µs/iter 565.54 µs         █
                    (541.88 µs … 631.88 µs) 596.92 µs         █
                    (456.00  b … 423.10 kb)   1.35 kb ▁▁▁▁▂▂█▇█▅▃▂▂▄▂▂▂▁▁▁▁

Alien                        432.57 µs/iter 437.13 µs    █
                    (412.50 µs … 532.96 µs) 475.67 µs    █   ▇▅
                    (504.00  b … 320.99 kb) 854.44  b ▂▁▂██▅▇██▅▃▄▂▂▁▁▁▁▂▁▁

                             ┌                                            ┐
                      Preact ┤ 420.08 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 565.35 µs
                       Alien ┤■■■ 432.57 µs
                             └                                            ┘

summary
  Preact
   1.03x faster than Alien
   1.35x faster than Lattice
  ✓ Completed in 10.85s

Running: scaling-subscribers

clk: ~2.97 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Scaling with Subscriber Count
------------------------------------------- -------------------------------
Preact - 25 subscribers       17.87 µs/iter  18.08 µs █
                      (14.79 µs … 53.88 µs)  41.71 µs █▇▃▃▃▁▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.60 ms …   3.03 ms)   5.76 kb (456.00  b…110.01 kb)

Preact - 50 subscribers       34.50 µs/iter  31.96 µs  █
                     (27.04 µs … 113.83 µs)  88.96 µs ▅█▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.34 ms …   8.95 ms)   8.33 kb (456.00  b…241.09 kb)

Preact - 100 subscribers      51.79 µs/iter  51.49 µs █  █▃
                      (50.69 µs … 55.70 µs)  54.73 µs █▆▆██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆
                  gc(  2.60 ms …   3.72 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 200 subscribers     116.12 µs/iter 124.04 µs  ▃▇█  ▂
                    (104.46 µs … 137.67 µs) 135.29 µs ▄███▇▇█▄▃▄▄▅▇▆█▇▆▄▃▂▂
                  gc(  1.40 ms …   2.61 ms)  25.23 kb (456.00  b…156.95 kb)

Preact - 400 subscribers     302.90 µs/iter 310.58 µs       ▅█  ▃▃
                    (275.71 µs … 337.75 µs) 329.83 µs ▂▂▂▂▄▅███▇███▇██▄▄▂▂▂
                  gc(  1.39 ms …   2.18 ms)   3.22 kb (456.00  b… 40.45 kb)

Lattice - 25 subscribers      15.58 µs/iter  14.75 µs  █
                      (13.17 µs … 52.13 µs)  36.71 µs ██▃▂▁▁▁▁▁▁▁▁▁▁▁▂▁▁▁▁▁
                  gc(  1.52 ms …   3.31 ms)   5.95 kb (504.00  b…203.27 kb)

Lattice - 50 subscribers      30.86 µs/iter  30.13 µs  █
                      (27.42 µs … 89.17 µs)  71.83 µs ██▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   3.12 ms)   8.68 kb (152.00  b…156.65 kb)

Lattice - 100 subscribers     52.43 µs/iter  52.48 µs        █
                      (52.04 µs … 53.26 µs)  52.77 µs █▁█▁████▁▁▁██▁▁▁▁▁▁██
                  gc(  2.55 ms …   3.96 ms)   0.11  b (  0.10  b…  0.12  b)

Lattice - 200 subscribers    111.31 µs/iter 114.50 µs █
                    (107.29 µs … 136.38 µs) 129.88 µs ██▂▄▄▄▅▇▃▂▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.57 ms …   3.08 ms)  23.94 kb (504.00  b…124.99 kb)

Lattice - 400 subscribers    311.54 µs/iter 317.33 µs      █▂▃ ▂
                    (289.38 µs … 357.50 µs) 349.08 µs ▁▂▄▅████▇██▆▃▂▂▂▁▂▁▁▁
                  gc(  1.44 ms …   2.97 ms)   3.70 kb (504.00  b… 72.49 kb)

Alien - 25 subscribers        13.83 µs/iter  13.21 µs █
                      (12.46 µs … 41.42 µs)  29.00 µs █▇▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.53 ms …   2.89 ms)   4.94 kb (456.00  b… 97.82 kb)

Alien - 50 subscribers        25.07 µs/iter  25.14 µs █ ██   █  █ █  ██   █
                      (24.88 µs … 25.29 µs)  25.24 µs █▁██▁▁▁█▁▁█▁█▁▁██▁▁▁█
                  gc(  2.05 ms …   3.31 ms)  20.03  b (  0.10  b…268.55  b)

Alien - 100 subscribers       49.96 µs/iter  50.17 µs    █         █
                      (49.65 µs … 50.32 µs)  50.25 µs ██▁█▁▁▁██▁▁▁▁█▁▁▁██▁█
                  gc(  2.54 ms …   4.89 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 200 subscribers      105.39 µs/iter 106.54 µs  █
                    (103.25 µs … 118.17 µs) 111.63 µs ▄██▂▂▂▂▂▂▂▂▂▂▂▁▂▂▂▂▂▂
                  gc(  1.55 ms …   2.90 ms)  24.26 kb (456.00  b…156.95 kb)

Alien - 400 subscribers      315.84 µs/iter 322.50 µs     ▂▅▆█▆▄
                    (294.04 µs … 362.71 µs) 348.13 µs ▃▄▄██████████▆▅▂▄▂▂▂▂
                  gc(  1.42 ms …   2.89 ms)   2.62 kb (440.00  b… 40.45 kb)

                             ┌                                            ┐
     Preact - 25 subscribers ┤ 17.87 µs
     Preact - 50 subscribers ┤■■ 34.50 µs
    Preact - 100 subscribers ┤■■■■ 51.79 µs
    Preact - 200 subscribers ┤■■■■■■■■■■■■ 116.12 µs
    Preact - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 302.90 µs
    Lattice - 25 subscribers ┤ 15.58 µs
    Lattice - 50 subscribers ┤■■ 30.86 µs
   Lattice - 100 subscribers ┤■■■■ 52.43 µs
   Lattice - 200 subscribers ┤■■■■■■■■■■■ 111.31 µs
   Lattice - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 311.54 µs
      Alien - 25 subscribers ┤ 13.83 µs
      Alien - 50 subscribers ┤■ 25.07 µs
     Alien - 100 subscribers ┤■■■■ 49.96 µs
     Alien - 200 subscribers ┤■■■■■■■■■■ 105.39 µs
     Alien - 400 subscribers ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 315.84 µs
                             └                                            ┘

summary
  Alien - $sources subscribers
   -1.01…+1.13x faster than Lattice - $sources subscribers
   -1.04…+1.29x faster than Preact - $sources subscribers
  ✓ Completed in 35.97s

Running: signal-updates

clk: ~3.06 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Signal Updates
------------------------------------------- -------------------------------
Preact - write only          353.56 µs/iter 321.67 µs █
                    (314.54 µs … 592.92 µs) 569.92 µs █
                    (408.00  b … 358.23 kb)   1.06 kb █▅▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅▁

Lattice - write only         235.48 µs/iter 412.17 µs █
                     (95.75 µs … 498.38 µs) 456.21 µs █
                    (120.00  b … 493.90 kb)   1.64 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁█▆▂▆

Alien - write only            71.14 µs/iter  47.29 µs █
                     (45.88 µs … 594.92 µs) 566.96 µs █
                    ( 32.00  b … 813.40 kb) 481.20  b █▅▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read only           234.15 µs/iter 406.79 µs █
                     (93.83 µs … 441.38 µs) 429.67 µs █                  ▃
                    ( 48.00  b … 557.40 kb)   1.13 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁██▂

Lattice - read only          215.28 µs/iter 403.75 µs █
                     (38.54 µs … 450.29 µs) 430.21 µs █                  █
                    ( 48.00  b … 429.40 kb)   1.14 kb █▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▅█▂

Alien - read only             92.50 µs/iter  61.83 µs █
                     (59.25 µs … 632.88 µs) 582.08 µs █
                    ( 48.00  b … 813.40 kb) 476.74  b █▁▁▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▂

Preact - read/write mixed    380.89 µs/iter 340.46 µs █
                    (328.08 µs … 883.08 µs) 835.38 µs █
                    (408.00  b … 422.49 kb)   1.04 kb █▆▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▃

Lattice - read/write mixed   309.07 µs/iter 751.13 µs █
                     (95.75 µs … 812.42 µs) 790.13 µs █
                    ( 48.00  b … 632.90 kb)   1.34 kb █▁▁▁▁▁▆▃▁▁▁▁▁▁▁▁▁▁▁▇▅

Alien - read/write mixed     349.83 µs/iter 207.63 µs █
                      (127.67 µs … 1.47 ms)   1.43 ms █
                    (408.00  b … 160.49 kb) 680.46  b ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▆

                             ┌                                            ┐
         Preact - write only ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 353.56 µs
        Lattice - write only ┤■■■■■■■■■■■■■■■■■■ 235.48 µs
          Alien - write only ┤ 71.14 µs
          Preact - read only ┤■■■■■■■■■■■■■■■■■■ 234.15 µs
         Lattice - read only ┤■■■■■■■■■■■■■■■■ 215.28 µs
           Alien - read only ┤■■ 92.50 µs
   Preact - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 380.89 µs
  Lattice - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■ 309.07 µs
    Alien - read/write mixed ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 349.83 µs
                             └                                            ┘

summary
  Alien - write only
   1.3x faster than Alien - read only
   3.03x faster than Lattice - read only
   3.29x faster than Preact - read only
   3.31x faster than Lattice - write only
   4.34x faster than Lattice - read/write mixed
   4.92x faster than Alien - read/write mixed
   4.97x faster than Preact - write only
   5.35x faster than Preact - read/write mixed
  ✓ Completed in 10.79s

Running: sparse-updates

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Sparse Updates (10-25% change rate)
------------------------------------------- -------------------------------
Preact - 10% sparse updates   37.32 µs/iter  35.79 µs █▂
                      (34.67 µs … 99.17 µs)  68.21 µs ██▁▂▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.47 ms …   3.21 ms)  14.44 kb (456.00  b…516.09 kb)

Preact - 15% sparse updates   45.17 µs/iter  44.17 µs  █
                      (43.21 µs … 83.21 µs)  65.71 µs ▆█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.34 ms …   2.95 ms)   8.05 kb (456.00  b…274.27 kb)

Preact - 20% sparse updates   56.30 µs/iter  56.51 µs                  █
                      (54.85 µs … 57.47 µs)  56.81 µs ▆▁▁▁▁▁▆▁▁▆▁▁▁▁▆▆▆█▁▆▆
                  gc(  2.56 ms …   3.77 ms)   0.10  b (  0.10  b…  0.11  b)

Preact - 25% sparse updates   74.52 µs/iter  75.08 µs        █▅
                      (71.63 µs … 93.63 µs)  80.63 µs ▃▇▂▂▂▄███▄▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.57 ms)   5.69 kb (456.00  b…124.95 kb)

Lattice - 10% sparse updates  35.93 µs/iter  32.96 µs █
                     (30.42 µs … 299.92 µs) 106.63 µs ██▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.39 ms …   5.22 ms)  10.88 kb (504.00  b…769.09 kb)

Lattice - 15% sparse updates  48.37 µs/iter  46.00 µs █
                     (45.04 µs … 176.92 µs) 127.21 µs █▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.43 ms …   6.48 ms)   8.01 kb (504.00  b…170.09 kb)

Lattice - 20% sparse updates  58.18 µs/iter  58.30 µs                     █
                      (57.81 µs … 58.74 µs)  58.41 µs █▁▁▁██▁██▁▁███▁▁█▁▁▁█
                  gc(  2.52 ms …   3.86 ms)   0.11  b (  0.10  b…  0.12  b)

Lattice - 25% sparse updates  78.04 µs/iter  78.88 µs      ▆█▂
                      (74.75 µs … 89.67 µs)  87.71 µs ▅█▄▄▆███▃▂▂▁▁▁▁▁▁▁▁▁▁
                  gc(  1.37 ms …   2.82 ms)   8.38 kb (504.00  b…132.99 kb)

Alien - 10% sparse updates    30.83 µs/iter  30.13 µs █
                      (29.33 µs … 71.33 µs)  58.54 µs █▆▁▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.36 ms …   3.05 ms)   9.57 kb (504.00  b…243.29 kb)

Alien - 15% sparse updates    44.27 µs/iter  44.38 µs   █▂▄
                      (43.67 µs … 58.79 µs)  46.71 µs ▂▇████▄▃▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.45 ms …   2.92 ms)   4.74 kb (456.00  b… 52.99 kb)

Alien - 20% sparse updates    55.90 µs/iter  56.07 µs       █       █
                      (55.39 µs … 56.58 µs)  56.37 µs █▁▁▁███▁█▁▁██▁█▁▁▁▁▁█
                  gc(  2.50 ms …   3.92 ms)   0.11  b (  0.10  b…  0.11  b)

Alien - 25% sparse updates    76.14 µs/iter  76.71 µs     ▅█
                      (72.33 µs … 96.58 µs)  89.79 µs ▄▆▂▄██▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁
                  gc(  1.38 ms …   2.73 ms)  11.56 kb (456.00  b…132.95 kb)

                             ┌                                            ┐
 Preact - 10% sparse updates ┤■■■■■ 37.32 µs
 Preact - 15% sparse updates ┤■■■■■■■■■■ 45.17 µs
 Preact - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■ 56.30 µs
 Preact - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 74.52 µs
Lattice - 10% sparse updates ┤■■■■ 35.93 µs
Lattice - 15% sparse updates ┤■■■■■■■■■■■■■ 48.37 µs
Lattice - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■■■ 58.18 µs
Lattice - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 78.04 µs
  Alien - 10% sparse updates ┤ 30.83 µs
  Alien - 15% sparse updates ┤■■■■■■■■■■ 44.27 µs
  Alien - 20% sparse updates ┤■■■■■■■■■■■■■■■■■■ 55.90 µs
  Alien - 25% sparse updates ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 76.14 µs
                             └                                            ┘

summary
  Alien - $changeRatio% sparse updates
   -1.02…+1.21x faster than Preact - $changeRatio% sparse updates
   +1.02…+1.17x faster than Lattice - $changeRatio% sparse updates
  ✓ Completed in 31.75s

Running: wide-fanout

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• Fan-out 10 Computeds
------------------------------------------- -------------------------------
Preact                       306.89 µs/iter 308.21 µs       █
                    (294.21 µs … 448.63 µs) 327.21 µs       █ ▂
                    ( 15.59 kb … 535.09 kb)  56.59 kb ▁▁▁▁▁▃█▄██▃▂▂▁▁▁▁▁▁▁▁

Lattice                      473.58 µs/iter 473.42 µs    █
                    (465.21 µs … 613.63 µs) 504.04 µs    █▂
                    ( 25.18 kb … 558.18 kb)  56.37 kb ▂▁▁██▃▂▂▂▁▂▂▁▁▁▁▁▁▁▁▁

Alien                        295.01 µs/iter 294.38 µs   █
                    (286.75 µs … 468.29 µs) 324.17 µs   █▄
                    ( 16.46 kb … 596.59 kb)  56.82 kb ▁▁██▄▂▁▂▁▅▃▂▂▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■ 306.89 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 473.58 µs
                       Alien ┤ 295.01 µs
                             └                                            ┘

summary
  Alien
   1.04x faster than Preact
   1.61x faster than Lattice

• Fan-out 100 Computeds
------------------------------------------- -------------------------------
Preact                       363.70 µs/iter 363.63 µs      █
                    (350.33 µs … 604.71 µs) 391.75 µs      █
                    (  5.87 kb …   1.46 mb)   7.96 kb ▁▁▁▂▁██▅▂▁▂▂▁▁▁▁▁▁▁▁▁

Lattice                      454.99 µs/iter 453.13 µs     █
                    (436.71 µs … 568.83 µs) 512.08 µs     █
                    (  5.96 kb … 608.46 kb)   8.00 kb ▁▁▁▁█▃▂▄▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        297.79 µs/iter 297.33 µs   █
                    (287.33 µs … 429.88 µs) 349.63 µs   █▇
                    (  5.52 kb …   1.17 mb)   8.50 kb ▁▂██▄▂▃▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■■■■■■■■■■ 363.70 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 454.99 µs
                       Alien ┤ 297.79 µs
                             └                                            ┘

summary
  Alien
   1.22x faster than Preact
   1.53x faster than Lattice

• Mixed Fan-out
------------------------------------------- -------------------------------
Preact                       259.40 µs/iter 261.83 µs    █
                    (248.79 µs … 326.88 µs) 287.04 µs    █ ▂
                    (  5.59 kb … 547.37 kb)   7.15 kb ▂▁▁█▇█▃▂█▂▂▂▁▁▁▂▁▁▁▁▁

Lattice                      363.83 µs/iter 362.67 µs █
                    (359.58 µs … 430.67 µs) 396.83 µs █
                    (  5.87 kb … 402.96 kb)   7.20 kb █▆▇▃▂▂▂▁▁▂▁▁▁▁▁▁▁▁▁▁▁

Alien                        270.85 µs/iter 273.46 µs  █▃
                    (262.42 µs … 425.67 µs) 305.33 µs  ██▂
                    (  5.52 kb … 941.09 kb)   8.44 kb ▁███▃▅▃▂▁▇▃▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 259.40 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 363.83 µs
                       Alien ┤■■■■ 270.85 µs
                             └                                            ┘

summary
  Preact
   1.04x faster than Alien
   1.4x faster than Lattice
  ✓ Completed in 10.82s

Running: write-heavy

clk: ~3.07 GHz
cpu: Apple M1 Max
runtime: node 23.10.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
• 100 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        54.89 µs/iter  54.54 µs    █
                      (52.96 µs … 88.13 µs)  63.13 µs    █
                    ( 48.00  b … 914.24 kb) 827.36  b ▁▁▂█▁▁▁▁▂▁▁▁▁▁▁▁▂▁▁▁▁

Lattice                      106.13 µs/iter 104.67 µs  █
                     (97.38 µs … 255.71 µs) 178.63 µs  █
                    ( 29.92 kb …   1.03 mb) 547.17 kb ▃██▆▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                         45.88 µs/iter  44.46 µs  █
                     (42.96 µs … 122.79 µs)  84.21 µs  █
                    ( 32.00  b …   1.45 mb) 712.16  b ▂█▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤■■■■■ 54.89 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 106.13 µs
                       Alien ┤ 45.88 µs
                             └                                            ┘

summary
  Alien
   1.2x faster than Preact
   2.31x faster than Lattice

• 1000 Writes, 1 Read
------------------------------------------- -------------------------------
Preact                        31.99 µs/iter  31.13 µs  █
                      (30.08 µs … 94.21 µs)  55.54 µs  █
                    ( 32.00  b … 288.49 kb) 507.56  b ▂█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Lattice                       98.10 µs/iter  96.38 µs  ▆█
                     (89.50 µs … 232.92 µs) 166.17 µs  ██
                    ( 50.87 kb … 955.92 kb) 547.46 kb ▂██▂▁▁▂▁▁▁▁▁▁▁▁▁▁▁▁▂▁

Alien                         40.49 µs/iter  40.13 µs  █
                     (37.75 µs … 111.21 µs)  77.75 µs  █
                    ( 32.00  b … 250.90 kb) 570.08  b ▁█▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 31.99 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 98.10 µs
                       Alien ┤■■■■ 40.49 µs
                             └                                            ┘

summary
  Preact
   1.27x faster than Alien
   3.07x faster than Lattice

• Wide Graph Write-Heavy
------------------------------------------- -------------------------------
Preact                        94.45 µs/iter  93.71 µs      █
                     (90.71 µs … 251.13 µs) 102.33 µs      █
                    (  2.37 kb … 649.96 kb)   6.71 kb ▁▁▁▂▂█▁▁▁▂▃▂▂▁▁▁▁▁▁▁▁

Lattice                      144.18 µs/iter 142.00 µs  █
                    (135.50 µs … 309.33 µs) 214.71 µs  █
                    ( 11.89 kb …   1.42 mb) 553.79 kb ▁█▄▂▃▂▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁

Alien                        135.93 µs/iter 134.92 µs    █▆
                    (130.21 µs … 236.13 µs) 152.71 µs    ██
                    (  5.52 kb …   1.01 mb)   7.07 kb ▁▁▂██▂▆▃▂▂▄▁▁▂▂▁▁▁▁▁▁

                             ┌                                            ┐
                      Preact ┤ 94.45 µs
                     Lattice ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 144.18 µs
                       Alien ┤■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 135.93 µs
                             └                                            ┘

summary
  Preact
   1.44x faster than Alien
   1.53x faster than Lattice
  ✓ Completed in 10.81s

Summary:
  Total: 12
  Success: 12
  Failed: 0