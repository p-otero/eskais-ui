# 05 · Propuesta mínima de arquitectura (para revisión)

## Estructura

```text
eskais-ui/
├── registry/
│   ├── ui/                 # componentes: button, input, search-field, dialog, confirm-dialog, card, badge
│   ├── lib/                # cn() y utilidades mínimas
│   ├── styles/             # tokens + tema (registry:theme / registry:style)
│   └── rules/              # config opcional de @shadcn/lint + oxlint para consumidores
├── apps/showcase/          # Vite + React 19, Inter vía rsms.me CDN
├── skills/eskais-ui/       # skill breve, complementa ui-sdk
├── test/                   # setup jsdom compartido
├── docs/research/          # estos documentos
├── public/r/               # salida de `shadcn build` (commiteada, servida desde GitHub)
├── registry.json
├── AGENTS.md
└── package.json            # Bun workspaces: apps/*
```

Sin `packages/core`: no hay lógica compartida que no sea UI SDK. Las primitives propias viven junto a su componente (`registry/ui/search-field/search-field-primitive.ts` + `search-field.tsx`) y se distribuyen en el mismo item.

## Principios de componentes

1. Control operable ⇒ parte de UI SDK (nunca `<button>`/`<input>` desnudo).
2. Presentacional (`Card`, `Badge`) ⇒ `renderElement` de UI SDK (da `render` prop coherente) sin primitive.
3. Comportamiento que UI SDK no trae ⇒ `definePrimitive` + `createParts`, con `agent.actions` explícitas.
4. Componentes compuestos (`ConfirmDialog`, `SearchField`) re-exportan sus partes y aceptan `controller`/`on*Change`.
5. Estilos: Tailwind v4 con tokens semánticos y `data-*` de estado; variantes con `cva`; sin copy por defecto en idioma concreto salvo labels accesibles sobreescribibles.
6. Sin providers obligatorios. El bridge `createAgent` lo crea la app.

## Catálogo v0.1

| Item             | Base                                                                        | Demuestra                                                                            |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `button`         | UI SDK `Button`                                                             | pending async, `aria-disabled` focusable, variantes                                  |
| `input`          | UI SDK `Input`/`InputGroup`/`InputClear` + `Field`                          | clear con foco, controlled/uncontrolled                                              |
| `search-field`   | **primitive propia** (`definePrimitive`) envolviendo `Input` vía controller | Escape-clear sólo si hay texto, Enter → `onSearch`, `agent: { actions: ["submit"] }` |
| `dialog`         | UI SDK `Dialog`                                                             | focus trap, Escape, outside press, restauración de foco, `dismissible`               |
| `confirm-dialog` | UI SDK `AlertDialog` + `action`                                             | pending, sin doble submit, cierre al éxito, error inline, `data-agent-confirm`       |
| `card`, `badge`  | `renderElement`                                                             | presentacional, tokens                                                               |
| `theme`          | CSS vars light/dark                                                         | tokens shadcn + semánticos                                                           |

Tests: comportamiento (Testing Library), `checkPattern` (dialog, alertdialog), primitive (`mount`/`checkServer`), test de agente (snapshot + act + permiso `allow` denegado/aprobado para el confirm destructivo).

## Decisiones a revisar

Decididas (2026-11-15): **D1** Vitest + jsdom · **D2** oxfmt exacto · **D3** nombres shadcn · **D4** URL raw de GitHub con repo público (hacer público el repo requiere autorización explícita) · **D5** semver con `bun pm version`, tags `vX.Y.Z`, CHANGELOG y GitHub Release (las públicas requieren autorización) · **D6** `no-restyle` opcional para consumidores · **D7** pocos comentarios: reglas en AGENTS.md + plugin oxlint interno (`no-low-value-comments` warn, sin código comentado, TODO con issue) · **D8** sin capa C · **D9** catálogo con `confirm-dialog`. Baseline cerrado. **D10** (2026-11-15) temas en tiempo de ejecución: los componentes leen tokens de forma, densidad y superficie; `theme-compact` y `theme-glass` son CSS aplicado con `data-theme` (anidable), no variantes de componente. Se descarta el modelo de shadcn (estilo fijado al instalar con clases `cn-*` transformadas por su CLI) porque impide cambiar en caliente, ajustar `--glass-opacity` y aplicar glass por zonas.

| #   | Decisión                                                | Propuesta                                                                                | Alternativa                                                                     |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| D1  | Runner de tests                                         | Vitest + jsdom ejecutado con Bun (doc oficial UI SDK; único que pasó todo)               | `bun test` + jsdom por preload (pasa UI SDK, falla `<form action>` de React 19) |
| D2  | Formatter                                               | oxfmt exacto                                                                             | `bun fmt` nativo (semanas de vida)                                              |
| D3  | Nombres de tokens                                       | shadcn (`background`, `primary`, `muted`, `ring`…) + `success/warning/info/destructive`  | nombres de Eskais (`canvas`, `ink`…)                                            |
| D4  | Distribución                                            | `public/r` commiteado, instalación por URL raw de GitHub (requiere repo público o token) | servir con GitHub Pages                                                         |
| D5  | Versionado                                              | CHANGELOG + tags                                                                         | changesets                                                                      |
| D6  | `@shadcn/lint no-restyle` para consumidores             | se distribuye como config opcional                                                       | obligatorio                                                                     |
| D7  | Reglas t3code `no-low-value-comments`/`no-em-dash-copy` | no adoptar                                                                               | adoptar                                                                         |
| D8  | Capa declarativa (C)                                    | no construir; A+B                                                                        | PoC de hook propio                                                              |
| D9  | Catálogo                                                | el de arriba (añade `confirm-dialog`)                                                    | el original de 6                                                                |
