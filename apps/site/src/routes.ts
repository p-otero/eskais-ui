import { guides } from "./guides/meta"
import { componentItems } from "./registry"

type Route = { path: string; title: string; description: string }

const siteName = "Eskais UI"
const tagline =
  "Agent-native, accessible React components on Vercel UI SDK, styled with Tailwind v4 and installed with shadcn."

const componentPath = (name: string) => `/docs/components/${name}`
const guidePath = (slug: string) => `/docs/${slug}`

const routes: Route[] = [
  { path: "/", title: `${siteName}: agent-native React components`, description: tagline },
  ...guides.map((guide) => ({
    path: guidePath(guide.slug),
    title: `${guide.title} · ${siteName}`,
    description: guide.description,
  })),
  {
    path: "/docs/components",
    title: `Components · ${siteName}`,
    description: "Every component in the Eskais registry.",
  },
  ...componentItems.map((item) => ({
    path: componentPath(item.name),
    title: `${item.title ?? item.name} · ${siteName}`,
    description: item.description ?? "",
  })),
]

export { componentPath, guidePath, routes, siteName, tagline }
export type { Route }
