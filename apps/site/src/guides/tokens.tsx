import { A, Article, Code, DocTable, DocTitle, H2, P, Ul } from "../docs/prose"

const spacing = [
  ["gap-inline", "icon + text, parts inside one control, chip or row", "0.375rem", "0.25rem"],
  ["gap-items", "siblings in a list or stack: cards, chips, buttons, form fields", "0.5rem", "0.375rem"],
  ["gap-group", "groups inside a surface: header vs body, dialog sections", "1rem", "0.75rem"],
  ["gap-section", "surfaces on a page: board columns, stat cards, a page's blocks", "1.5rem", "1rem"],
  ["px-inset-chip / py-inset-chip", "pills, badges, chips, kbd", "0.5rem / 0.125rem", "0.375rem / 0.125rem"],
  [
    "px-inset-item / py-inset-item",
    "menu and list items, small cards, table cells",
    "0.625rem / 0.5rem",
    "0.5rem / 0.375rem",
  ],
  ["px-control-x", "buttons, inputs, selects", "0.875rem", "0.625rem"],
  ["p-inset-surface", "cards, dialogs, panels, popovers", "1.5rem", "1rem"],
  ["p-control-inset", "the rim of a control-height bar around -sm items", "2px", "2px"],
]

const type = [
  ["text-meta", "eyebrows, kickers, overlines (with tracking-meta)", "11/14/500"],
  ["text-caption", "hints, timestamps, table footnotes", "12/16"],
  ["text-body-sm", "secondary text, descriptions in dense UI", "13/18"],
  ["text-body", "default UI and reading text", "14/20"],
  ["text-title-sm", "card, panel and list-group titles", "15/20/600"],
  ["text-title", "dialog, drawer and section titles", "18/24/600"],
  ["text-display-sm", "page titles, stat values", "24/28/650"],
  ["text-display", "hero numbers, empty-state headlines", "28/32/700"],
]

const layers = [
  ["z-sticky", "20", "sticky headers, a Floating bar"],
  ["z-overlay", "40", "dialog and drawer backdrops and content"],
  ["z-popover", "50", "popovers, menus, list popups, tooltips"],
  ["z-toast", "60", "the toast region, above everything else"],
  ["duration-micro", "140ms", "hover and press feedback, popovers, menus, tooltips"],
  ["duration-panel", "180ms", "panels that resize or slide: accordion, sidebar, toasts"],
  ["duration-dialog", "200ms", "dialogs and their backdrop"],
  ["ease-standard", "cubic-bezier(0.2, 0, 0, 1)", "every token-timed transition"],
]

function Swatch({ className }: { className: string }) {
  return (
    <span className="flex h-6 items-center rounded-sm bg-muted">
      <span className={`h-full rounded-sm bg-primary/70 ${className}`} />
    </span>
  )
}

export default function Tokens() {
  return (
    <Article>
      <DocTitle
        eyebrow="Theming"
        title="Spacing and tokens"
        description='Spacing, type, elevation and motion are chosen by role, never by number. The values change with the density, so data-density="compact" tightens everything at once, and the corner radius is an axis of its own.'
      />

      <H2 id="spacing">Spacing roles</H2>
      <P>
        Choose by relationship, not by look: parts of the same thing use <Code>gap-inline</Code> or{" "}
        <Code>gap-items</Code>, distinct groups <Code>gap-group</Code>, separate surfaces <Code>gap-section</Code>.
        Every spacing utility takes the roles: <Code>p-inline</Code>, <Code>pb-group</Code>, <Code>-mx-inline</Code>.
        The Compact column is <Code>data-density="compact"</Code> (or the <Code>data-theme="compact"</Code> alias), at
        any radius; <A to="/docs/theming#density-and-radius">Theming</A> covers both axes.
      </P>
      <DocTable
        label="Spacing roles"
        head={["Utility", "Role", "Default", "Compact"]}
        rows={spacing.map(([utility, role, base, compact]) => [<Code key="u">{utility}</Code>, role, base, compact])}
      />
      <div className="flex flex-col gap-items" aria-hidden="true">
        {["w-1.5", "w-2", "w-4", "w-6"].map((width) => (
          <Swatch key={width} className={width} />
        ))}
      </div>
      <Ul>
        <li>A component never sets outer margin: the parent spaces its children with gap.</li>
        <li>
          Sizes (<Code>h-control</Code>, <Code>size-control-sm</Code>) are not spacing; prefer the size tokens.
        </li>
      </Ul>

      <H2 id="typography">Typography</H2>
      <P>
        Each step sets size and line height, and the meta, title and display steps a weight. Caption, body-sm and body
        keep the weight they inherit, so a <Code>&lt;strong&gt;</Code> or <Code>&lt;th&gt;</Code> stays bold.
      </P>
      <DocTable
        label="Type roles"
        head={["Utility", "Role", "Size / line / weight"]}
        rows={type.map(([utility, role, size]) => [
          <span key="u" className={utility}>
            {utility}
          </span>,
          role,
          size,
        ])}
      />

      <H2 id="elevation">Elevation</H2>
      <P>
        In-page surfaces (cards, board columns, panels) use <Code>shadow-surface</Code> and <Code>rounded-surface</Code>
        . Anything that floats above the page uses <Code>surface-floating</Code>: popovers, menus, select lists, hover
        cards and toasts. Dialogs and drawers take the floating shadow, border and radius but stay opaque reading
        surfaces in every theme.
      </P>
      <div className="grid grid-cols-2 gap-section max-sm:grid-cols-1">
        <div className="rounded-surface border bg-card p-inset-surface text-body-sm shadow-surface">shadow-surface</div>
        <div className="surface-floating p-inset-surface text-body-sm">surface-floating</div>
      </div>

      <H2 id="layers">Layers and motion</H2>
      <DocTable
        label="Layers and motion"
        head={["Utility", "Value", "Role"]}
        rows={layers.map(([utility, value, role]) => [<Code key="u">{utility}</Code>, value, role])}
      />
      <P>
        <Code>prefers-reduced-motion: reduce</Code> collapses every transition and animation in the base layer;
        components add <Code>motion-reduce:</Code> only to swap a movement for a fade.
      </P>

      <H2 id="touch">Touch targets</H2>
      <P>
        On a coarse pointer, controls reach a 44px hit area without changing how they look on a desktop: the{" "}
        <Code>touch-target</Code> class adds a centred <Code>::before</Code> to buttons, toggles, tabs, checkboxes,
        radios and switches. Rows that stack closer grow with <Code>pointer-coarse:</Code> instead.
      </P>

      <H2 id="narrow">The narrow breakpoint</H2>
      <P>
        <Code>narrow:</Code> applies at 760px and below. Write the wide layout first and override it:{" "}
        <Code>flex-row narrow:flex-col</Code>. It's about the viewport, not density; prefer container queries for a
        component that lives in panels of different widths. Colours are on the <A to="/docs/tone">Tone and colour</A>{" "}
        page.
      </P>
    </Article>
  )
}
