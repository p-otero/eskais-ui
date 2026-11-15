# 04 · Tooling, reglas de lint y CI

Referencias leídas (config y workflows reales): `pingdotgg/t3code`, `vercel-labs/ui`, `shadcn-ui/ui`, `shadcn-ui/lint`. Versiones de npm a 2026-11-15.

## Qué usan los referentes

|           | t3code                                                                         | vercel-labs/ui                                                                         | shadcn-ui/ui                                                   |
| --------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| PM        | pnpm 12 + Vite+ (`vp`)                                                         | pnpm 10, Node 24                                                                       | pnpm 10 + turbo (Bun sólo para scripts)                        |
| Lint      | oxlint inline en `vite.config.ts`, plugin propio de 32 reglas + `@shadcn/lint` | scripts propios + ESLint (react-hooks 7) con baseline de supresiones                   | ESLint 9                                                       |
| Format    | oxfmt (`vp fmt`)                                                               | Prettier                                                                               | Prettier                                                       |
| Typecheck | tsgo (TS 7 nativo)                                                             | tsc                                                                                    | tsc                                                            |
| Tests     | Vitest; **DOM sólo en navegador real** (prohíbe jsdom/happy-dom)               | Vitest + jsdom + 385 specs Playwright (40 con axe + lector de pantalla virtual)        | Vitest + browser tests                                         |
| CI        | `changes` → jobs afectados, check agregado, acciones por SHA                   | tiers (affected/nightly/full), `passed` agregado, `check:packages` = consumidor limpio | matriz de 5 plantillas × 4 PMs instalando desde registry local |
| Deps      | —                                                                              | Dependabot (Actions mensual agrupado, npm sólo seguridad)                              | —                                                              |
| Release   | —                                                                              | changesets + npm OIDC                                                                  | changesets                                                     |

Ninguno es Bun-first. Eskais UI lo será para desarrollo, manteniendo Node donde el ecosistema lo exige (Playwright, consumidor limpio npm/pnpm).

## Bun 1.4.4: qué es nativo

- `bun fmt`: **nativo** (1.4.4, port de oxc_formatter, semanas de vida).
- `bun check`: **nativo** (1.4.3, typechecker port de tsgo; no emite).
- `bun lint`: **no existe**; sólo ejecuta el script `lint`.
- Un script `fmt`/`check` en `package.json` **sombrea** el comando nativo (usar `--no-script`).
- `bun test`: nativo. `[test] environment` documentado **no funciona** en 1.4.4 → DOM por preload.
- `bun build`: innecesario (el registry distribuye fuente; no genera `.d.ts`).

## Tests DOM: evidencia

| Entorno                           | Spike Eskais UI (dialog `checkPattern`, foco, SearchField + agente) | Agente de tooling (React 19 `<form action>`) |
| --------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| bun test + happy-dom              | **falla** `checkPattern` (falsos negativos)                         | falla                                        |
| bun test + jsdom (preload manual) | pasa                                                                | falla con `global-jsdom`                     |
| Vitest + jsdom (Node)             | pasa                                                                | **pasa**                                     |

Conclusión: jsdom obligatorio; Vitest es el entorno documentado por UI SDK y el único que pasó todo. Real browser (Playwright) para foco/top layer/contraste.

## Tabla de reglas

Recomendación: **adoptar** · **opcional** · **descartar** · **consultar**.

| Regla                                                                                                                     | Problema                                           | Beneficio                               | Coste                                                     | Rec.                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| oxlint `correctness`                                                                                                      | bugs reales                                        | casi sin falsos positivos               | ~0                                                        | **adoptar** (error)                                                            |
| oxlint `suspicious`                                                                                                       | bugs probables                                     | buena señal                             | algo de ruido                                             | **adoptar** (warn)                                                             |
| oxlint `perf` (sin `no-map-spread`, `prefer-set-has`)                                                                     | patrones lentos                                    | gratis                                  | bajo                                                      | **adoptar**                                                                    |
| `pedantic`/`style`/`restriction`                                                                                          | gusto                                              | consistencia                            | mucho ruido                                               | **descartar**                                                                  |
| `react/*` reglas de React Compiler (`purity`, `refs`, `immutability`, `set-state-in-effect/render`, `static-components`…) | romper Rules of React                              | corrección                              | algún falso positivo                                      | **adoptar**                                                                    |
| `react/exhaustive-effect-dependencies`                                                                                    | closures obsoletos                                 | corrección                              | ~0                                                        | **adoptar**                                                                    |
| `react/no-array-index-key`, `no-unstable-nested-components`                                                               | remounts                                           | corrección (y la skill UI SDK lo exige) | ~0                                                        | **adoptar**                                                                    |
| jsx-a11y (oxlint)                                                                                                         | a11y básica                                        | señal temprana                          | bajo                                                      | **adoptar**                                                                    |
| `no-restricted-imports`: `bun`, `bun:*`, `node:*` en `registry/**`                                                        | código que no corre en consumidores Node/navegador | protege npm/pnpm                        | ~0                                                        | **adoptar**                                                                    |
| `no-restricted-imports`: `@ui-sdk/react` sólo por subpath, nunca `@ui-sdk/core/internal/*`                                | imports inválidos                                  | lo exige UI SDK                         | ~0                                                        | **adoptar**                                                                    |
| `reportUnusedDisableDirectives: error` + motivo obligatorio en supresiones                                                | supresiones silenciosas                            | auditable                               | ~0                                                        | **adoptar**                                                                    |
| t3code `no-manual-memo`                                                                                                   | `useMemo` manual                                   | limpio con Compiler                     | **incorrecto en un registry** (consumidores sin Compiler) | **descartar** en `registry/**`                                                 |
| t3code `no-native-title-tooltip`                                                                                          | `title=` como tooltip                              | a11y                                    | portar ~30 líneas                                         | **opcional**                                                                   |
| t3code reglas de tests (wall clock, esperas reales, skip sin motivo)                                                      | flakiness                                          | CI determinista                         | portar                                                    | **opcional** (cuando haya plugin propio)                                       |
| t3code `no-dom-test-environment`                                                                                          | emuladores DOM mienten                             | fuerza navegador real                   | choca con tests rápidos en jsdom                          | **descartar** por ahora                                                        |
| t3code `no-low-value-comments`, `no-em-dash-copy`                                                                         | ruido de agentes                                   | higiene                                 | heurístico                                                | **consultar**                                                                  |
| Reglas type-aware (`no-floating-promises`)                                                                                | bugs async                                         | alto valor                              | lento, alpha                                              | **opcional** (más tarde, sólo CI)                                              |
| knip                                                                                                                      | código muerto                                      | higiene                                 | config                                                    | **opcional** (cuando la estructura se estabilice)                              |
| `@shadcn/lint` `no-raw-colors`                                                                                            | colores de paleta/hex                              | theming real                            | allow-list puntual                                        | **adoptar**                                                                    |
| `@shadcn/lint` `no-arbitrary-values`                                                                                      | valores mágicos (`text-[13px]`, 388 en Eskais)     | escala de tokens                        | allow-list                                                | **adoptar**                                                                    |
| `@shadcn/lint` `no-unknown-classes`                                                                                       | clases que Tailwind no genera                      | detecta estilos rotos                   | carga Tailwind (lento)                                    | **adoptar**                                                                    |
| `@shadcn/lint` `require-static-classes`                                                                                   | clases dinámicas                                   | JIT y lint funcionan                    | mapas de lookup                                           | **adoptar**                                                                    |
| `@shadcn/lint` `no-restyle` (fuera de `registry/ui`)                                                                      | reestilar componentes por `className`              | contrato visual para agentes            | contratos a mantener                                      | **adoptar** en showcase; **opcional** para consumidores (se distribuye config) |
| `@shadcn/lint` `no-inline-styles`                                                                                         | `style={{}}`                                       | consistencia                            | excepciones para CSS vars                                 | **opcional**                                                                   |
| Ast-grep "no `role=dialog                                                                                                 | menu                                               | listbox…` a mano" (Eskais)              | reimplementar UI SDK                                      | lo exige la skill UI SDK                                                       | ~0  | **opcional consumidor** (vía regla `no-restricted-syntax` o ast-grep) |
| Un componente exportado por fichero / nombre = fichero (Eskais ARCH-UI-004/005)                                           | caos de registry                                   | items claros                            | ~0                                                        | **adoptar** (convención, no lint)                                              |

## Toolchain propuesto

| Tarea          | Herramienta                                                               | Versión                  |
| -------------- | ------------------------------------------------------------------------- | ------------------------ |
| Runtime/PM     | Bun (`packageManager: bun@1.4.4`, `bun.lock`, workspaces)                 | 1.4.4                    |
| Lint           | `oxlint` + `@shadcn/lint` (jsPlugin)                                      | 1.93.0 / 0.2.5 (exactas) |
| Format         | `oxfmt` (exacto; el nativo `bun fmt` se reevalúa)                         | 0.78.0                   |
| Typecheck      | `typescript` (`tsc -b`, referencia)                                       | 7.0.2                    |
| Tests          | Vitest + jsdom + Testing Library + user-event, lanzado con `bun run test` | 5.x                      |
| a11y unit      | `axe-core` directo (sin contraste) + `checkPattern` de UI SDK             | 4.14                     |
| Navegador real | Playwright (Node) — fase siguiente                                        | 1.65                     |
| Showcase       | Vite 8 + `@vitejs/plugin-react` + `@tailwindcss/vite`                     | 8.x                      |
| Registry       | `shadcn build` + `shadcn registry validate`                               | 4.23.0                   |
| UI SDK         | `@ui-sdk/core` + `@ui-sdk/react` **exactos**                              | 0.1.0-beta.5             |

No adoptar ahora: Vite+, turbo, changesets, knip, regresión visual.

## CI baseline

`ci.yml` (PR + push a `main` + manual; `permissions: contents: read`; acciones por SHA; `persist-credentials: false`; sin `${{ }}` en `run:`):

1. **check** (~2-3 min): `bun install --frozen-lockfile` → lint → fmt check → typecheck → tests.
2. **registry**: `shadcn build` → `shadcn registry validate` → `git diff --exit-code public/r`.
3. **consumer** (Node 24; matriz npm/pnpm): app Vite limpia → Tailwind v4 → `shadcn add` de cada item desde `public/r` local → `tsc --noEmit` + `vite build` + un test de humo.
4. **showcase**: `vite build`.
5. **passed**: agregado, único check requerido.

`workflows-lint.yml` (sólo cambios en `.github/**`): actionlint + zizmor.
Semanal/manual (más adelante): Playwright Chromium/WebKit/Firefox + axe + `shadcn@latest` en consumidor.
Dependencias: Dependabot (Actions mensual agrupado; npm sólo seguridad) — comprobar soporte de `bun.lock`; si falla, Renovate.
Versionado: CHANGELOG manual + tags git. Changesets sólo si se llega a publicar en npm.
