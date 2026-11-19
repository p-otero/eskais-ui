// Eskais UI's own oxlint rules for consumers, loaded through `jsPlugins` by eskais-ui.oxlintrc.json.

const CONTROLS = new Set(["Button", "Toggle"])
// A control already inside one of these gets its tooltip from there.
const TOOLTIP_WRAPPERS = new Set(["ControlTooltip", "TooltipTrigger"])

function elementName(name) {
  if (name.type === "JSXIdentifier") return name.name
  if (name.type === "JSXMemberExpression") return name.property.name
  return ""
}

function isIconElement(node) {
  if (node.type !== "JSXElement") return false
  const name = elementName(node.openingElement.name)
  return name === "Icon" || name.endsWith("Icon")
}

// An icon, or a choice between icons like `{copied ? <CheckIcon /> : <CopyIcon />}`.
function isIconExpression(node) {
  if (isIconElement(node)) return true
  if (node.type === "ConditionalExpression")
    return isIconExpression(node.consequent) && isIconExpression(node.alternate)
  if (node.type === "LogicalExpression") return isIconExpression(node.right)
  return false
}

function iconOnly(children) {
  let icons = 0
  for (const child of children) {
    if (child.type === "JSXText") {
      if (child.value.trim() !== "") return false
    } else if (child.type === "JSXExpressionContainer") {
      if (child.expression.type === "JSXEmptyExpression") continue
      if (!isIconExpression(child.expression)) return false
      icons++
    } else if (isIconElement(child)) {
      icons++
    } else {
      return false
    }
  }
  return icons > 0
}

function attribute(opening, name) {
  return opening.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.name === name)
}

function isIconSize(attr) {
  if (!attr?.value) return false
  if (attr.value.type === "Literal") return attr.value.value === "icon"
  // `size={size}` can't be read here, so it gets the benefit of the doubt.
  return attr.value.type === "JSXExpressionContainer" && attr.value.expression.type !== "Literal"
}

function insideTooltip(node) {
  let parent = node.parent
  if (parent?.type === "JSXElement") return TOOLTIP_WRAPPERS.has(elementName(parent.openingElement.name))
  // `<TooltipTrigger render={<Button … />}>`
  while (parent && parent.type !== "JSXAttribute") {
    if (parent.type === "JSXElement" || parent.type === "Program") return false
    parent = parent.parent
  }
  const opening = parent?.parent
  return opening?.type === "JSXOpeningElement" && TOOLTIP_WRAPPERS.has(elementName(opening.name))
}

const iconButtonNeedsLabel = {
  meta: {
    type: "problem",
    docs: {
      description:
        'An icon-only Button or Toggle takes size="icon" and an aria-label, so it has a name and shows it in a tooltip.',
    },
    messages: {
      label: 'Icon-only {{name}} without a name. Give it size="icon" and an aria-label: the tooltip shows the label.',
      size: 'Icon-only {{name}} without size="icon", so it shows no tooltip. Use size="icon" (resize it with a class).',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        const opening = node.openingElement
        const name = elementName(opening.name)
        if (!CONTROLS.has(name) || !iconOnly(node.children)) return
        if (opening.attributes.some((attr) => attr.type === "JSXSpreadAttribute")) return
        if (insideTooltip(node)) return
        const labelled = attribute(opening, "aria-label") ?? attribute(opening, "aria-labelledby")
        if (!labelled) {
          context.report({ node: opening, messageId: "label", data: { name } })
          return
        }
        if (!isIconSize(attribute(opening, "size")) && !attribute(opening, "tooltip")) {
          context.report({ node: opening, messageId: "size", data: { name } })
        }
      },
    }
  },
}

const OVERFLOW = /(?:^|[\s"'`:!])(overflow-(?:[xy]-)?(?:auto|scroll))(?=$|[\s"'`!])/

// Every string and template literal counts, not only a className attribute: class lists also live in consts, cva()
// variants and arrays outside the JSX that uses them.
const scrollArea = {
  meta: {
    type: "suggestion",
    docs: { description: "A component that scrolls its own content does it in a ScrollArea from scroll-area." },
    messages: {
      bare: 'Bare {{token}}: scroll in a ScrollArea from "scroll-area" (its viewport sets the overflow and draws the scrollbar), or disable this rule on the line before with the reason.',
    },
  },
  create(context) {
    const check = (node, text) => {
      const token = OVERFLOW.exec(text)?.[1]
      if (token) context.report({ node, messageId: "bare", data: { token } })
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value)
      },
      TemplateLiteral(node) {
        check(node, node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(" "))
      },
    }
  },
}

export { iconButtonNeedsLabel, scrollArea }

export default {
  meta: { name: "eskais" },
  rules: {
    "icon-button-needs-label": iconButtonNeedsLabel,
    "scroll-area": scrollArea,
  },
}
