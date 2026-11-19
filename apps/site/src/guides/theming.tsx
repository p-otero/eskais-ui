import { ThemeEditor } from "../../../showcase/src/theme-editor"
import { appearance, palettes, themeEditor } from "../appearance"
import { A, Article, Code, DocTable, DocTitle, H2, H3, P, Pre, Ul } from "../docs/prose"

const seeds = `:root {
  --brand: oklch(0.55 0.2 262);      /* primary, ring, accent */
  --link-brand: oklch(0.55 0.2 262); /* links and the caret */
  --neutral-hue: 262;                /* tint the greys toward the brand */
  --neutral-chroma: 0.01;
  --radius: 0.75rem;
}`

export default function Theming() {
  return (
    <Article>
      <DocTitle
        eyebrow="Theming"
        title="Theming"
        description="A handful of seed tokens derive every colour in light and dark. Palettes, density, corner radius and glass are attribute scopes you can nest anywhere."
      />

      <H2 id="editor">Theme editor</H2>
      <P>
        Pick a preset, a brand and a link colour, tint the greys, and choose the density and the corner radius. The
        whole site follows, on every page and on your next visit, until you press Reset; copy the CSS when you like it.
      </P>
      <section
        aria-label="Theme editor"
        data-slot="theme-editor-card"
        className="min-w-0 rounded-surface border bg-card p-inset-surface narrow:p-group"
      >
        <ThemeEditor appearance={appearance} palettes={palettes} store={themeEditor} />
      </section>

      <H2 id="seeds">Seeds</H2>
      <P>
        Set the seeds in <Code>:root</Code>. Primary, its foreground, ring, accent and the greys derive from them in
        both modes. To take over one colour, set that token in <Code>:root</Code> or <Code>.dark</Code>. Keep a custom
        brand at 4.5:1 on the background.
      </P>
      <Pre code={seeds} language="css" title="src/index.css" />
      <Ul>
        <li>
          <Code>--primary-foreground</Code> follows <Code>--brand</Code>, near-white or near-black, and reaches at least
          4.5:1 on any sRGB colour. Dark mode lightens a dark brand on its own.
        </li>
        <li>
          <Code>--link-brand</Code> colours links apart from the brand. It defaults to a blue, so links keep a hue under
          the near-black neutral brand, and their lightness is clamped to keep 4.5:1. The palettes set it to their
          brand.
        </li>
        <li>
          Derived colours use CSS relative colour syntax: Chrome 119, Firefox 128, Safari 18 and later. Older browsers
          keep the default neutral look.
        </li>
      </Ul>

      <H2 id="palettes">Palettes</H2>
      <P>
        <Code>@eskais/palettes</Code> ships presets: <Code>data-palette="neutral"</Code> (the default look),{" "}
        <Code>"blue"</Code>, <Code>"violet"</Code>, <Code>"green"</Code> and <Code>"orange"</Code>, on any element or
        through <Code>createAppearance({"{ palette }"})</Code>.
      </P>

      <H2 id="density-and-radius">Density and radius</H2>
      <P>
        Two axes, each an attribute on <Code>&lt;html&gt;</Code> or any element, that every component follows through
        its tokens. Choose them apart: a compact table with square corners, a roomy page of pills.
      </P>
      <DocTable
        label="Density and radius"
        head={["Attribute", "Values", "What it changes"]}
        rows={[
          [
            <Code key="a">data-density</Code>,
            <Code key="v">default | compact</Code>,
            "Control heights and padding, every spacing role and the type steps. Needs the theme-compact item.",
          ],
          [
            <Code key="a">data-radius</Code>,
            <Code key="v">none | sm | md | lg | full</Code>,
            "The radius of controls, choices, surfaces and floating UI. Without it the shape derives from --radius (lg).",
          ],
          [
            <Code key="a">data-theme="compact"</Code>,
            "alias",
            "Compact density with the md radius and flatter surfaces, as before the axes split. data-density or data-radius on the same element wins.",
          ],
        ]}
      />
      <Pre
        code={`const appearance = createAppearance({
  density: "compact",
  radius: "sm",
  storage: {
    density: createLocalStorage("density"),
    radius: createLocalStorage("radius"),
  },
})

appearance.radius.set("full")`}
        language="ts"
        title="src/appearance.ts"
      />

      <H2 id="themes">Compact and glass</H2>
      <DocTable
        label="Themes"
        head={["Item", "Attribute", "What it changes"]}
        rows={[
          [<Code key="i">theme</Code>, "none", "Semantic colours, shape, density and surface tokens."],
          [
            <Code key="i">theme-compact</Code>,
            <Code key="a">data-density="compact"</Code>,
            'Compact density at any width, and the data-theme="compact" alias (compact density with the md radius).',
          ],
          [
            <Code key="i">theme-glass</Code>,
            <Code key="a">data-theme="glass"</Code>,
            "Translucent, blurred chrome: popovers, menus, toasts, sidebar and cards. Dialogs stay opaque.",
          ],
        ]}
      />
      <P>
        A theme only sets tokens, so never branch on it in a component. Nest scopes freely: a compact table inside a
        default page, a glass toolbar over a photo.
      </P>
      <P>
        Tune glass live by setting <Code>--glass-opacity</Code> (and <Code>--glass-blur</Code>) on the element that has{" "}
        <Code>data-theme="glass"</Code> or on a descendant. The editor above turns glass on for the whole site, and its
        strength (40% by default: 60% opaque, a 20px blur) goes into the CSS as a <Code>[data-theme="glass"]</Code>{" "}
        rule. Dialogs and drawers stay opaque at any strength: a translucent fill over the dimmed backdrop reads grey.
        Glass falls back to solid surfaces when the browser lacks <Code>backdrop-filter</Code> or the person asks for
        reduced transparency.
      </P>

      <H2 id="dark-mode">Dark mode</H2>
      <Ul>
        <li>
          <Code>createAppearance({'{ colorScheme: "system" }'})</Code> and <Code>&lt;Appearance&gt;</Code> keep{" "}
          <Code>.dark</Code>, <Code>data-color-scheme</Code>, <Code>data-theme</Code>, <Code>data-palette</Code>,{" "}
          <Code>data-density</Code> and <Code>data-radius</Code> on <Code>&lt;html&gt;</Code> in sync. Call{" "}
          <Code>appearance.apply()</Code> before the first render to avoid a flash.{" "}
          <Code>appearance.colorScheme.set("dark")</Code> and <Code>appearance.theme.set("compact")</Code> change them,
          and <Code>storage: {"{ colorScheme, theme, density, radius }"}</Code> (from <Code>createLocalStorage</Code>)
          keeps them between visits. It needs no server, so it works in a static <Code>file://</Code> page.
        </li>
        <li>
          Before any script runs, the theme follows <Code>prefers-color-scheme: dark</Code>, unless{" "}
          <Code>&lt;html&gt;</Code> has <Code>data-color-scheme="light"</Code> or <Code>class="light"</Code>: render one
          from the server for a saved light choice.
        </li>
        <li>
          The theme item ships a <Code>@custom-variant dark</Code> block that follows the same rule. Keep it below the
          one-line variant <Code>shadcn init</Code> writes; Tailwind uses the last one.
        </li>
      </Ul>

      <H3 id="elevation">Elevation</H3>
      <P>
        Two levels: in-page surfaces (<Code>shadow-surface</Code>, <Code>rounded-surface</Code>) and floating UI (
        <Code>surface-floating</Code>: border, radius, translucent popover fill, shadow and backdrop).{" "}
        <Code>data-elevation="flat"</Code> on any ancestor drops the floating shadow, blur and translucency. See{" "}
        <A to="/docs/tokens#elevation">Spacing and tokens</A>.
      </P>
    </Article>
  )
}
