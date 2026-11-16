import { ButtonLink } from "@/components/ui/button-link"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

import { linkTo } from "./router"

function NotFound({ inline = false }: { inline?: boolean }) {
  const content = (
    <Empty size="page">
      <EmptyHeader>
        <EmptyTitle render={<h1>Page not found</h1>} />
        <EmptyDescription>The page you asked for isn't part of these docs.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <ButtonLink variant="outline" {...linkTo("/docs/components")}>
          Browse components
        </ButtonLink>
      </EmptyContent>
    </Empty>
  )
  if (inline) return content
  return (
    <main id="main" tabIndex={-1} className="flex flex-1 items-center justify-center px-group py-section outline-none">
      {content}
    </main>
  )
}

export { NotFound }
