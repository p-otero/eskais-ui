import { Link } from "@/components/ui/link"

import { categories } from "../content/categories"
import { slug } from "../header"
import { findItem } from "../registry"
import { componentPath } from "../routes"
import { linkTo } from "../router"
import { DocTitle, H2 } from "./prose"

function ComponentsIndex() {
  const count = categories.reduce((total, category) => total + category.items.length, 0)
  return (
    <>
      <DocTitle
        eyebrow="Components"
        title="Every component"
        description={`${count} registry items, each a UI SDK part or primitive an agent can read, styled with the theme's tokens and installed as source with shadcn.`}
      />
      {categories.map((category) => (
        <section key={category.name} aria-labelledby={slug(category.name)} className="flex flex-col gap-items">
          <H2 id={slug(category.name)}>{category.name}</H2>
          <ul className="grid grid-cols-3 gap-items narrow:grid-cols-1 max-lg:grid-cols-2">
            {category.items.map((name) => {
              const item = findItem(name)
              return (
                <li key={name} className="flex">
                  <Link
                    {...linkTo(componentPath(name))}
                    variant="plain"
                    className="flex w-full flex-col gap-inline rounded-surface border bg-card px-inset-item py-inset-item outline-none transition-colors duration-micro ease-standard hover:border-input-strong hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-title-sm">{item?.title ?? name}</span>
                    <span className="line-clamp-2 text-body-sm text-muted-foreground">{item?.description}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

export { ComponentsIndex }
