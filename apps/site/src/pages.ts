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

const guideSection = (name: string) => ({
  name,
  pages: guides
    .filter((guide) => (guide.group ?? "Getting started") === name)
    .map((guide) => ({
      route: guidePath(guide.slug),
      title: guide.title,
      description: guide.description,
      section: name,
      keywords: guide.covers ?? [],
    })),
})

const docSections: { name: string; pages: DocPage[] }[] = [
  guideSection("Getting started"),
  guideSection("Tools"),
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
