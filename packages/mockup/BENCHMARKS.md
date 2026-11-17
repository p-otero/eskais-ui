# Benchmarks

## Hand-written HTML against a TSX mockup (2026-11-17)

Does an agent spend less building a mockup with `@eskais/mockup` than writing it as a single HTML file? One screen, one model, one run per side.

### Setup

- **Model:** DeepSeek V4.1 Flash with maximum thinking, on both sides.
- **Brief:** the same text on both sides, in fresh threads. Neither side had built the screen before.
- **Side A:** write the screen as one hand-written HTML file.
- **Side B:** write `.mockups/api-keys/screen.tsx` and `fixtures.ts` with the project's own Eskais UI components, then build and check them with `bun packages/mockup/src/cli.ts validate api-keys`.
- **Screen, "API keys":**
  - a page header with an action;
  - Active and Revoked tabs with counts;
  - a six-column table with scope badges and a row menu;
  - a create-key dialog with required-name validation, scope checkboxes, an expiry select and a show-once key with Copy;
  - a revoke confirmation dialog that moves rows between tabs;
  - an empty state;
  - light and dark from `prefers-color-scheme`.
- **Scope:** both sides covered the whole brief with zero console errors.

### How the numbers were measured

Every number below was measured from the provider's usage logs for each thread, not reported by the agents. Cost is the API-equivalent price of those tokens. Wall time is approximate, from the first to the last model call of each thread.

### Results

|                       | A: hand-written HTML          | B: `@eskais/mockup` TSX                   | B vs A |
| --------------------- | ----------------------------- | ----------------------------------------- | ------ |
| Model calls           | 93                            | 63                                        | −32%   |
| Output tokens         | 143k                          | 56.5k                                     | −60%   |
| of which reasoning    | 96.9k                         | 38.3k                                     | −60%   |
| Uncached input        | 239k                          | 152k                                      | −36%   |
| Cache read            | 13.9M                         | 5.84M                                     | −58%   |
| Cost (API-equivalent) | $0.163                        | $0.074                                    | −55%   |
| Wall time (approx.)   | ~28 min                       | ~12 min                                   | −57%   |
| Agent deliverable     | 89.6 KB / 2,720 lines of HTML | 21 KB `screen.tsx` + 1.5 KB `fixtures.ts` |        |
| Built page            | 90 KB                         | 887 KB (components and fonts inlined)     |        |

B needed one `validate` run. Its TSX uses the project's real components and can be reused for the final implementation. A's HTML is throwaway and re-implements styles, dialogs, menus and keyboard handling by hand.

### Caveat

n=1: one screen, one model, one run per side. The direction is clear; repeat with more screens, more models and several runs per side before treating the numbers as firm.

### Repeating it

1. Pick a screen with real interaction: at least one dialog with validation, a menu and a state change that moves data between views. Write the brief once and give both sides the same text.
2. Use one model and the same settings for both sides, each in a fresh thread with no earlier work on the screen.
3. Side A: ask for one self-contained HTML file covering the brief, light and dark.
4. Side B: give it this package's skill (`skills/eskais-mockup/SKILL.md`) and a project with `components.json`, and ask for `.mockups/<name>/screen.tsx` and `fixtures.ts`, checked with `validate`.
5. Check that both cover the whole brief with no console errors before comparing; a side that drops part of the brief isn't comparable.
6. Read model calls, output and reasoning tokens, uncached input, cache reads and cost from the provider's usage logs for each thread. Don't ask the agent to report them.
7. Record the deliverable's size and the built page's size (`manifest.json` holds B's).
8. Add the run here as a new section with its date, model and screen, keeping earlier runs.
