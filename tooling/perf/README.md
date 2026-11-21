# Performance harness

Measures keyboard and navigation performance in system Chrome (Playwright and CDP). The method and the results are in
`docs/perf/REPORT.md`.

```sh
bun run perf                      # everything, both builds, 1× and 4× CPU: about 50 minutes
bun run perf --only=list-1k,table --cpu=1 --skip=held,overlays,mount,site,bundle
```

| Option                                   | Effect                                                                                                                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--no-build`                             | reuse the builds in `tooling/perf/.builds/` (and the site's `dist`, built when missing)                                                                                                                                                  |
| `--builds=normal,compiler`               | which showcase builds; a name starting with `compiler` builds with React Compiler. `normal@before,normal@after` compares two builds of different sources: build one, change the source, build the other, then run both with `--no-build` |
| `--repeat=3`                             | runs the builds three times, a fresh browser each, in reverse order every other time                                                                                                                                                     |
| `--cpu=1,4`                              | CPU throttling rates                                                                                                                                                                                                                     |
| `--only=…`                               | scenario ids from `scenarios.mjs`, plus `overlays`, `site` and `bundle`                                                                                                                                                                  |
| `--skip=held,overlays,mount,site,bundle` | leave parts out                                                                                                                                                                                                                          |
| `--no-trace`                             | no Chrome trace (the main-thread breakdown comes from the trace at 1×)                                                                                                                                                                   |
| `--experiments`                          | run only the scenarios marked `experiment`, which inject a CSS change into the page                                                                                                                                                      |
| `--name=baseline`                        | writes `results/<name>.json` and `results/traces/<name>-…json`                                                                                                                                                                           |

## Budgets in CI

`bun run perf:ci` checks `tooling/perf/budgets.json` in about a minute: React renders per key press (the most any of
20 presses caused, counted as the press's frame starts, so work a component defers past the paint never counts) and forced layouts per press in each listed scenario, the board's composited layers, and every
registry item's gzip size. Counts are exact on any machine, except that forced layouts get 0.1 per press of slack and
render counts above 20 get 5% (a virtualized list renders a few more rows when a scroll event lands a frame later);
sizes get 5% of headroom when written. A scenario whose forced layouts move from run to run, like a virtualized list
measuring the rows a scroll brings in, declares its own `forcedSlack` (0.3 for the 10k list, ServerList,
MasterDetail, the combobox and the board's Tab, whose counts varied by that much on one build). `test:browser` runs it on the showcase it has just built; CI runs it in the `perf` job.

It also loads each showcase fixture under `vitals` in `budgets.json` cold three times on the slow 4G profile at 1×
and holds the median CLS at 0.01 or less and LCP under its budget, 15% over the value it was written with (LCP there
is mostly the transfer, so it moves less between machines than render-bound times).

- Over budget: make the change fit, or raise the number in `budgets.json` and say why in the commit.
- A new registry item or scenario: `bun run perf:ci --update` writes today's values; commit them.
- A change that lowers a count: run `--update` too, so the budget holds the gain.

A scenario can also set `paintP95`, a ceiling in ms on key to next paint (PrismPicker sets 24). CI's runner has no
GPU, so Chrome composites there in software and a canvas, filter or blend that a GPU makes cheap can cost a frame
more. `PERF_SOFTWARE=1 bun run perf:ci` (`--disable-gpu`) reproduces it locally; `PERF_SOFTWARE=swiftshader` emulates
GL in software too, the worst case. Compare with another scenario run the same way: the frame itself sets a floor near
16 ms there.

## Load and layout shift

`bun run perf:vitals` loads pages cold (a new browser context each time) on a slow 4G profile and reads TTFB, FCP,
LCP, CLS and INP from PerformanceObservers registered before the page's scripts: CLS is the largest session window of
shifts that no input caused, as web-vitals computes it, and INP the longest of four Tab presses after load. Each
result lists the worst run's shifts with the elements that moved, to find what to reserve space for.

```sh
bun run perf:vitals --builds=normal --sites=current --cpu=1,4 --repeat=3   # showcase blocks, docs site
bun run perf:vitals --builds=normal@before,normal@after --sites=before:<dist>,after:apps/site/dist --name=vitals-ab
```

Showcase targets: `shell`, `dashboard-grid`, `settings-page`, `document-workspace`, `master-detail`, and the
ServerDataTable and ServerList fixtures with an 800 ms server delay (`?delay=`), from loading to data. Site targets:
the landing page, the DataTable page and the Server data guide. `--network=none` drops the 4G profile, `--only=` picks
targets, `--name=` names `results/<name>.json`.

## Comparing two versions

```sh
bun run perf --builds=normal@before --only=list-1k,table --skip=overlays,mount,site,bundle   # builds the current source
# change the code
bun run perf --builds=normal@after --only=list-1k,table --skip=overlays,mount,site,bundle
bun run perf --no-build --builds=normal@before,normal@after --repeat=3 --only=list-1k,table --skip=overlays,mount,site,bundle --name=ab
node tooling/perf/compare.mjs ab   # medians, before → after
```

Other tools:

- `node tooling/perf/bundle.mjs [items…]`: gzip size of registry items with their dependencies, and the UI SDK
  share.
- `node tooling/perf/layers.mjs <scenario> [build] [--glass] [--css=<rules>] [--settle=<ms>]`: composited layers and their
  reasons, counted after `--settle` ms (500 by default; 4000 lets the status pings end).
- `node tooling/perf/trace-chart.mjs <trace.json> <out.png> [press] [title]`: one key press as a flame chart.

Fixtures are `?demo=perf&scenario=<id>` in the showcase (`apps/showcase/src/perf/`). Run nothing else on the
machine while measuring: single runs at 4× vary by ±50%, so compare counts and repeated A/B runs.
