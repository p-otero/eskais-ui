import { EditorView } from "@codemirror/view"

const mono = "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)"
const code = ".cm-line[data-md-code]"
const indent = 1.5

const headings = [
  ["display-sm", "650"],
  ["title", "600"],
  ["title-sm", "600"],
  ["body", "600"],
  ["body", "600"],
  ["body-sm", "600"],
].map(([step, weight], index) => [
  `.cm-line[data-md-heading='${index + 1}']`,
  {
    fontSize: `var(--type-${step}-size)`,
    lineHeight: `var(--type-${step}-leading)`,
    fontWeight: weight,
    letterSpacing: index < 3 ? "-0.012em" : "normal",
    paddingTop: index < 2 ? "var(--gap-items)" : "0",
  },
])

const depths = Array.from({ length: 8 }, (_, index) => [
  `.cm-line[data-md-depth='${index + 1}']`,
  { paddingInlineStart: `calc(var(--md-quote-inset, 0px) + ${(index + 1) * indent}em)` },
])

// CodeMirror injects its base theme unlayered, so Tailwind's layered utilities can't override it; this theme
// is injected the same way and reads only the semantic tokens.
const markdownEditorTheme = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "transparent",
    height: "100%",
    fontSize: "inherit",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--foreground)", padding: "var(--gap-group) var(--control-padding)" },
  ".cm-line": { padding: "0" },
  ".cm-content ::selection, .cm-content::selection": {
    backgroundColor: "color-mix(in oklab, var(--ring) 35%, transparent)",
  },
  ".cm-placeholder": { color: "var(--muted-foreground)" },

  "[data-slot=markdown-syntax], [data-slot=markdown-list-number]": { color: "var(--muted-foreground)" },
  "[data-slot=markdown-list-number]": { fontVariantNumeric: "tabular-nums" },
  "[data-slot=markdown-strong]": { fontWeight: "600" },
  "[data-slot=markdown-emphasis]": { fontStyle: "italic" },
  "[data-slot=markdown-strike]": { textDecoration: "line-through" },
  "[data-slot=markdown-code]": {
    fontFamily: mono,
    fontSize: "0.9em",
    backgroundColor: "var(--muted)",
    borderRadius: "calc(var(--control-radius) / 2)",
    padding: "0 0.2em",
  },
  "[data-slot=markdown-link], [data-slot=markdown-wikilink]": {
    color: "var(--link)",
    textDecoration: "underline",
    textUnderlineOffset: "0.2em",
    cursor: "pointer",
  },
  "[data-slot=markdown-wikilink][data-unresolved], [data-slot=markdown-embed][data-unresolved]": {
    color: "var(--link-soft)",
    textDecorationStyle: "dashed",
  },
  "[data-slot=markdown-embed]": {
    color: "var(--link)",
    textDecoration: "underline",
    textUnderlineOffset: "0.2em",
    cursor: "pointer",
    border: "1px dashed var(--input-strong)",
    borderRadius: "var(--control-radius)",
    paddingInline: "var(--chip-padding-x)",
  },
  "[data-slot=markdown-embed-widget]": {
    display: "inline-block",
    maxWidth: "100%",
    verticalAlign: "top",
    fontFamily: "var(--font-sans)",
  },
  "[data-slot=markdown-html]": { fontFamily: mono, fontSize: "0.9em", color: "var(--muted-foreground)" },

  ...Object.fromEntries(headings),

  ".cm-line[data-md-quote]": {
    "--md-quote-inset": "0.75em",
    borderInlineStart: "2px solid var(--border)",
    paddingInlineStart: "var(--md-quote-inset)",
    color: "var(--muted-foreground)",
  },
  ...Object.fromEntries(depths),
  ".cm-line[data-md-item]": { textIndent: `-${indent}em` },
  "[data-slot=markdown-bullet]": {
    display: "inline-block",
    width: `${indent}em`,
    textIndent: "0",
    verticalAlign: "baseline",
    position: "relative",
  },
  "[data-slot=markdown-bullet]::before": {
    content: "''",
    position: "absolute",
    insetInlineStart: "0.45em",
    top: "-0.55em",
    width: "0.375em",
    height: "0.375em",
    borderRadius: "50%",
    backgroundColor: "var(--muted-foreground)",
  },
  ".cm-line[data-md-depth='2'] [data-slot=markdown-bullet]::before": {
    backgroundColor: "transparent",
    boxShadow: "inset 0 0 0 1.5px var(--muted-foreground)",
  },
  ".cm-line[data-md-depth='3'] [data-slot=markdown-bullet]::before": { borderRadius: "1px" },
  "input[data-slot=markdown-task]": {
    accentColor: "var(--primary)",
    width: "1em",
    height: "1em",
    margin: "0 0.5em 0 0",
    textIndent: "0",
    verticalAlign: "-0.125em",
    cursor: "pointer",
  },

  [code]: {
    fontFamily: mono,
    fontSize: "0.9em",
    backgroundColor: "var(--muted)",
    paddingInline: "var(--item-padding-x)",
  },
  ".cm-line[data-md-frontmatter]": {
    fontFamily: mono,
    fontSize: "0.9em",
    color: "var(--muted-foreground)",
    backgroundColor: "var(--muted)",
    paddingInline: "var(--item-padding-x)",
  },
  ".cm-line[data-md-frontmatter='open']": {
    borderStartStartRadius: "var(--control-radius)",
    borderStartEndRadius: "var(--control-radius)",
  },
  ".cm-line[data-md-frontmatter='close']": {
    borderEndStartRadius: "var(--control-radius)",
    borderEndEndRadius: "var(--control-radius)",
  },
  ".cm-line[data-md-code='open']": {
    borderStartStartRadius: "var(--control-radius)",
    borderStartEndRadius: "var(--control-radius)",
    paddingTop: "var(--gap-inline)",
  },
  ".cm-line[data-md-code='close']": {
    borderEndStartRadius: "var(--control-radius)",
    borderEndEndRadius: "var(--control-radius)",
  },
  "[data-slot=markdown-code-language]": {
    display: "inline-flex",
    fontFamily: "var(--font-sans)",
    textIndent: "0",
    verticalAlign: "middle",
  },
  ".cm-line[data-md-rule]": {
    background: "linear-gradient(var(--border), var(--border)) center / 100% 1px no-repeat",
  },

  ".cm-line[data-md-table='header']": { fontWeight: "600" },
  ".cm-line[data-md-table] [data-slot=markdown-syntax]": { fontWeight: "400" },
  ".cm-line[data-md-table='delimiter']": { color: "var(--muted-foreground)" },
  "[data-slot=markdown-table-cell]": { display: "inline-block", whiteSpace: "pre" },
  "[data-slot=markdown-table-widget]": { paddingBlock: "var(--gap-inline)", fontFamily: "var(--font-sans)" },

  [`${code} .tok-keyword, ${code} .tok-operator`]: { color: "var(--primary)" },
  [`${code} .tok-string, ${code} .tok-string2`]: { color: "var(--success)" },
  [`${code} .tok-number, ${code} .tok-bool, ${code} .tok-atom`]: { color: "var(--info)" },
  [`${code} .tok-comment`]: { color: "var(--muted-foreground)", fontStyle: "italic" },
  [`${code} .tok-typeName, ${code} .tok-className`]: { color: "var(--warning)" },
})

export { markdownEditorTheme }
