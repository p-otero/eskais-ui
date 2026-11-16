// Every <svg> element counts, not only components named `…Icon`: the registry's hand-drawn icons also hid in
// helpers named `Chevron`, `Arrow` or `icon()`, in maps of path strings, and inline in JSX.
export default {
  meta: {
    type: "problem",
    docs: { description: "Icons come from lucide-react; an inline <svg> is a drawing that isn't an icon." },
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
