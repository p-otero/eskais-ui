const project = `---
title: Atlas
tags: [planning, q3]
---

# Atlas

Links to [[roadmap]], [[people/ines|Ines]] and [[Meeting notes 2026-11-02]].
An unclosed [[wikilink stays text, and \\[[escaped]] too.

Setext title
============

Subtitle
---

* star bullet
* another star
    * nested four spaces
        * deeper

- dash bullet
  - nested two spaces
    1. ordered inside
    2) paren style

+ plus bullet

1. one
1. one again
10. ten

- [ ] open task
- [x] done task
- [X] capital X
  - [ ] nested task

| Left | Center | Right |
|:-----|:------:|------:|
| a \\| b | \`c|d\` | **e** |
| missing |

Trailing two spaces for a hard break
next line\\
and a backslash break.

Escapes: \\*not emphasis\\*, \\_nope\\_, \\# not a heading, 1\\. not a list, &amp; &copy; &#x1F600;

\`\`\`js title="x.js"
function f() {
\treturn "tab-indented"
}
\`\`\`

~~~
tilde fence
~~~

    indented code block

<details><summary>HTML block</summary>

Inside **HTML**.

</details>

<script>alert("not run")</script>

Footer with trailing spaces   \t
`

export const markdownNotes: Record<string, string> = {
  project,
  crlf: project.replace(/\n/g, "\r\n"),
  "mixed line endings": "# Mixed\r\nline one\nline two\r\nline three\rold mac\n",
  bom: "﻿# With a BOM\n\nText.\n",
  "no final newline": "Last line has no newline",
  "only whitespace": "  \n\t\n   ",
  empty: "",
  unicode: "# Ünïcödé 🚀\n\n- 日本語 [[ノート]]\n- emoji 👩🏽‍💻 and combining é\n- RTL: שלום [[עמוד|דף]]\n",
  "nbsp and zero width": "a b​c d\n",
  nul: "before\u0000after\n",
  "lone surrogate": "broken \ud83d text\n",
  "deep nesting": Array.from({ length: 20 }, (_, depth) => `${"  ".repeat(depth)}- level ${depth}`).join("\n") + "\n",
  "wikilink edge cases": "[[a]] [[a|]] [[|b]] [[ spaced ]] [[a|b|c]] [[]] [[a]]]] [[[a]]] `[[code]]`\n",
  embeds:
    "![[diagram.png]]\n\nInline ![[notes/plan|the plan]] and ![[ x ]] beside ![image](a.png) and ![[]] and !![[two]]\n\n- ![[in a list]]\n> ![[quoted|Quote]]\n",
  "frontmatter, lists and blocks":
    '---\ntitle: "Plan: Q3"\naliases:\n  - plan\n  - \'q3 plan\'\ntags: [a, "b, c"]\nsummary: |\n  Two lines\n  of text\n# comment\nempty:\n---\n# After\n\nBody ![[embed]]\n',
  "frontmatter, CRLF and dots": "---\r\ntitle: x\r\n...\r\nText\r\n",
  "frontmatter, empty": "---\n---\n# Heading\n",
  "frontmatter, unclosed": "---\ntitle: x\n\nNot frontmatter: the rule and a paragraph.\n",
  "frontmatter, not first": "\n---\ntitle: x\n---\n",
}
