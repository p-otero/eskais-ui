import { categories } from "./content/categories"
import { guides } from "./guides/meta"
import { findItem } from "./registry"
import { componentPath, guidePath } from "./routes"

type DocPage = {
  route: string
  title: string
  description: string
  section: string
  keywords: string[]
}

const docSections: { name: string; pages: DocPage[] }[] = [
  {
    name: "Getting started",
    pages: guides.map((guide) => ({
      route: guidePath(guide.slug),
      title: guide.title,
      description: guide.description,
      section: "Getting started",
      keywords: guide.covers ?? [],
    })),
  },
  ...categories.map((category) => ({
    name: category.name,
    pages: category.items.map((name) => {
      const item = findItem(name)
      return {
        route: componentPath(name),
        title: item?.title ?? name,
        description: item?.description ?? "",
        section: category.name,
        keywords: [name],
      }
    }),
  })),
]

const docPages = docSections.flatMap((section) => section.pages)

function neighbours(route: string) {
  const index = docPages.findIndex((page) => page.route === route)
  if (index === -1) return { previous: undefined, next: undefined }
  return { previous: docPages[index - 1], next: docPages[index + 1] }
}

export { docPages, docSections, neighbours }
export type { DocPage }
