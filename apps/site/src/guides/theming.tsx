import { ThemeEditor } from "../../../showcase/src/theme-editor"
import { appearance, palettes } from "../appearance"
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
        eyebrow="Getting started"
        title="Theming"
        description="A handful of seed tokens derive every colour in light and dark. Palettes, density and glass are attribute scopes you can nest anywhere."
      />

      <H2 id="editor">Theme editor</H2>
      <P>
        Pick a preset or a brand colour, tint the greys and set the radius. The whole site follows; copy the CSS when
        you like it.
      </P>
      <section
        aria-label="Theme editor"
        data-slot="theme-editor-card"
        className="min-w-0 rounded-surface border bg-card p-inset-surface narrow:p-group"
      >
        <ThemeEditor appearance={appearance} palettes={palettes} />
      </section>

      <H2 id="seeds">Seeds</H2>
      <P>
        Set the seeds in <Code>:root</Code>. Primary, its foreground, ring, accent and the greys derive from them in
        both modes. To take over one colour, set that token in <Code>:root</Code> or <Code>.dark</Code>. Keep a custom
        brand at 4.5:1 on the background.
      </P>
      <Pre code={seeds} language="css" title="src/index.css" />

      <H2 id="palettes">Palettes</H2>
      <P>
        <Code>@eskais/palettes</Code> ships presets: <Code>data-palette="neutral"</Code> (the default look),{" "}
        <Code>"blue"</Code>, <Code>"violet"</Code>, <Code>"green"</Code> and <Code>"orange"</Code>, on any element or
        through <Code>createAppearance({"{ palette }"})</Code>.
      </P>

      <H2 id="themes">Compact and glass</H2>
      <DocTable
        label="Themes"
        head={["Item", "Attribute", "What it changes"]}
        rows={[
          [<Code key="i">theme</Code>, "none", "Semantic colours, shape, density and surface tokens."],
          [
            <Code key="i">theme-compact</Code>,
            <Code key="a">data-theme="compact"</Code>,
            "Denser controls, tighter radii, spacing and type, at any width.",
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

      <H2 id="dark-mode">Dark mode</H2>
      <Ul>
        <li>
          <Code>createAppearance({'{ colorScheme: "system" }'})</Code> and <Code>&lt;Appearance&gt;</Code> keep{" "}
          <Code>.dark</Code>, <Code>data-color-scheme</Code>, <Code>data-theme</Code> and <Code>data-palette</Code> on{" "}
          <Code>&lt;html&gt;</Code> in sync. Call <Code>appearance.apply()</Code> before the first render to avoid a
          flash.
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
