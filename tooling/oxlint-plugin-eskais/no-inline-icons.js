export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Icons come from lucide-react; any inline <svg>, whatever its function is called, is a drawing that isn't an icon.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "svg") return
        context.report({
          node,
          message:
            'Hand-drawn <svg>. Import the icon from lucide-react (see AGENTS.md "Icons"); for a drawing that is not an icon, disable this rule with the reason.',
        })
      },
    }
  },
}
