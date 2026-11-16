const SPACING_UTILITY =
  /^-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xyse])?|top|right|bottom|left|start|end|scroll-[mp][xytrblse]?)-(\d+(?:\.\d+)?)$/u
const ROLES =
  "gap-inline, gap-items, gap-group, gap-section, px/py-inset-chip, px/py-inset-item, px-control-x, p-inset-surface"

// Strips variants (`md:`, `data-[state=open]:`, `[&>svg]:`) and the important marker; a colon inside brackets
// belongs to an arbitrary variant, not a separator.
function utilityOf(token) {
  let depth = 0
  let start = 0
  for (let index = 0; index < token.length; index++) {
    const char = token[index]
    if (char === "[" || char === "(") depth++
    else if (char === "]" || char === ")") depth--
    else if (char === ":" && depth === 0) start = index + 1
  }
  return token.slice(start).replace(/^!|!$/gu, "")
}

function rawSpacing(token) {
  const match = SPACING_UTILITY.exec(utilityOf(token))
  return match !== null && Number(match[1]) !== 0
}

export default {
  meta: {
    type: "problem",
    docs: { description: "Spacing in the registry uses the role tokens, not the numeric Tailwind scale." },
  },
  create(context) {
    const check = (node, text) => {
      for (const token of text.split(/\s+/u)) {
        if (!rawSpacing(token)) continue
        context.report({
          node,
          message: `"${token}" is raw spacing. Use a role (${ROLES}); see AGENTS.md "Spacing".`,
        })
      }
    }
    return {
      Literal(node) {
        if (typeof node.value !== "string") return
        if (node.parent?.type === "ImportDeclaration" || node.parent?.type === "ExportNamedDeclaration") return
        check(node, node.value)
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw)
      },
    }
  },
}
