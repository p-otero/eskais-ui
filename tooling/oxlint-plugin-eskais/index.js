import { iconButtonNeedsLabel } from "../../registry/rules/eskais-oxlint-plugin.js"
import noInlineIcons from "./no-inline-icons.js"

export default {
  meta: { name: "eskais" },
  rules: {
    "icon-button-needs-label": iconButtonNeedsLabel,
    "no-inline-icons": noInlineIcons,
  },
}
