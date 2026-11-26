import { iconButtonNeedsLabel, noInlineIcons, scrollArea } from "../../registry/rules/eskais-oxlint-plugin.js"
import commentTags from "./comment-tags.js"

export default {
  meta: { name: "eskais" },
  rules: {
    "comment-tags": commentTags,
    "icon-button-needs-label": iconButtonNeedsLabel,
    "no-inline-icons": noInlineIcons,
    "scroll-area": scrollArea,
  },
}
