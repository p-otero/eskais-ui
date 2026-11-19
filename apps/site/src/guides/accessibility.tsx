import { A, Article, Code, DocTitle, H2, P, Ul } from "../docs/prose"

export default function Accessibility() {
  return (
    <Article>
      <DocTitle
        eyebrow="Guides"
        title="Accessibility"
        description="Keyboard, focus and ARIA come from UI SDK; contrast, targets and motion from the theme. What's left for you is naming things and structuring the page."
      />

      <H2 id="built-in">What the components do</H2>
      <Ul>
        <li>
          Keyboard and focus follow the ARIA Authoring Practices: arrow keys in menus, lists, tabs and radio groups,
          focus traps and restore in dialogs, one tab stop for toolbars and listboxes.
        </li>
        <li>
          Async actions stay focusable while pending, announce after a second, and ignore a second press (
          <A to="/docs/components/button">Button</A>, <A to="/docs/components/confirm-dialog">ConfirmDialog</A>,{" "}
          <A to="/docs/components/form">Form</A>).
        </li>
        <li>
          Text reaches 4.5:1 and control edges, focus rings and state fills 3:1, in every palette, theme and mode. CI
          checks it with axe and pixel sampling in Chrome.
        </li>
        <li>On a coarse pointer, controls reach a 44px hit area.</li>
        <li>
          Reduced motion collapses transitions; spinners and pulses turn into a fade. Status never rests on colour
          alone: stage markers, chart legends and dashed targets carry it too.
        </li>
      </Ul>

      <H2 id="you">What you do</H2>
      <Ul>
        <li>
          Name every control: a <Code>FieldLabel</Code>, a <Code>DialogTitle</Code>, or <Code>aria-label</Code> when
          there's no visible text. People with screen readers and agents both find controls by name.
        </li>
        <li>
          Render a <A to="/docs/components/skip-link">SkipLink</A> first and give the page one <Code>&lt;main&gt;</Code>{" "}
          (<Code>PageLayout as="main"</Code>).
        </li>
        <li>
          Give titles a heading level that fits your outline: <Code>CardTitle headingLevel</Code>,{" "}
          <Code>PageHeader headingLevel</Code>.
        </li>
        <li>
          Pass <Code>live</Code> to an <A to="/docs/components/alert">Alert</A> that appears after the page loads.
        </li>
        <li>Keep a custom brand colour at 4.5:1 on the background.</li>
      </Ul>

      <H2 id="testing">Testing</H2>
      <P>
        The registry's own tests run axe on every component, check keyboard paths, focus and right to left, and run the
        agent test. This site's smoke test loads pages in Chrome and requires zero axe violations and no horizontal
        scroll at 375px.
      </P>
    </Article>
  )
}
