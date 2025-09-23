# Benchmark Memory Issues

Lattice appears to have memory performance issues in the following benchmarks:

## `computed-diamond-simple`

Lattice  3.82 mb   ▆███▆█▆██▁█▆▆▆█▆▁▆█▁█
Preact   972.60 b  ▆▆█████▁█▁▄▁▁▁▁▁▁▁▁▁▄
Alien    895.42 b  ▃▁▁▁▇▅████▅▇▅▅▃▁▁▁▃▃▅

## `scaling-subscribers`

Preact - 10 subscribers    5.52 kb  ▃▃▂██▅▄▄▃▂▂▄▂▃▂▁▁▁▁▁▁
Preact - 25 subscribers    937.35 b ▃█████▇█▃▂▃▃▂▄▂▁▁▁▂▁▂
Preact - 50 subscribers    671.62 b ▅███▅███▁█▅██▅▁▁▁▅▁█▅
Preact - 100 subscribers   1.04 kb  ██▁██▁▁█▁█▁█▁▁▁▁▁█▁▁█
Preact - 200 subscribers   1.38 kb  █████▁▁▁▁▁▁▁▁▁▁█▁▁▁▁█
Lattice - 10 subscribers   1.09 mb  ▁███▄▅▃▂▆██▂▂▁▁▁▁▁▁▁▁
Lattice - 25 subscribers   4.58 mb  ▂▇██▇▇▄▇▃▁▂▂▃▄▃▄▇▂▂█▂
Lattice - 50 subscribers   13.22 mb ████▆█▁█▆▁▁▆▁▆▁█▆▁▆▁▆
Lattice - 100 subscribers  37.77 mb ███▁▁▁▁███▁▁▁▁▁▁█▁▁▁█
Lattice - 200 subscribers  43.37 mb █▁▁█▁▁▁███▁█▁███▁▁▁▁█
Alien - 10 subscribers     3.29 kb  ▁▁▃▃██▂▃▃▆██▆▆▃▃▃▂▂▂▁
Alien - 25 subscribers     1.39 kb  ▃▂█████▅▄▃▂▂▅▂▆█▃▂▂▃▃
Alien - 50 subscribers     408.00 b █████▁████▄▄▁█▄▁▁▁▄▁▄
Alien - 100 subscribers    408.00 b █▁▁▁██▁▁█▁▁▁██▁▁▁▁█▁█
Alien - 200 subscribers    408.00 b ██▁███▁▁▁▁█▁█▁▁▁█▁▁▁█
