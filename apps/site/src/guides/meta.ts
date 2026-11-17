type GuideMeta = {
  slug: string
  title: string
  description: string
  /** Registry items this guide documents instead of a component page. */
  covers?: string[]
}

const guides: GuideMeta[] = [
  {
    slug: "installation",
    title: "Installation",
    description:
      "Add the Eskais registry to components.json, set the aliases and install your first component with shadcn.",
    covers: ["utils", "font-geist", "font-inter", "lint-rules", "test-utils"],
  },
  {
    slug: "theming",
    title: "Theming",
    description: "Seed tokens, palettes, the compact and glass themes, dark mode and the theme editor.",
    covers: ["theme", "theme-compact", "theme-glass", "palettes"],
  },
  {
    slug: "tokens",
    title: "Spacing and tokens",
    description: "Spacing roles, typography, elevation, layers, motion, touch targets and the narrow breakpoint.",
  },
  {
    slug: "tone",
    title: "Tone and colour",
    description:
      "One vocabulary for status: neutral, info, success, warning, destructive and violet, with soft tokens and links.",
  },
  {
    slug: "icons",
    title: "Icons",
    description:
      "lucide-react icons by name, decorative or named with Icon, sized by their control and coloured by tone.",
    covers: ["icon"],
  },
  {
    slug: "keyboard",
    title: "Keyboard and long lists",
    description:
      "Shortcuts with scopes and a ? dialog, the keyboard map for lists and tables, and virtualization for thousands of rows.",
    covers: ["row-navigation", "virtual-rows"],
  },
  {
    slug: "agents",
    title: "Agents",
    description:
      "Every control is a UI SDK part an agent can read and operate, with a person approving what can't be undone.",
  },
  {
    slug: "mockups",
    title: "Mockups",
    description:
      "Sketch a screen in TSX with your own components and fixtures, then build one offline HTML file and validate it.",
  },
  {
    slug: "accessibility",
    title: "Accessibility",
    description:
      "Names, landmarks, focus, contrast, touch targets and reduced motion: what the components do and what you still do.",
  },
  {
    slug: "i18n",
    title: "Internationalization",
    description:
      "No default copy in a specific language: labels, form messages, dates and numbers in the reader's locale.",
  },
]

export { guides }
export type { GuideMeta }
