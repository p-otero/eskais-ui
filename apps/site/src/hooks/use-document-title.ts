import { useEffect } from "react"

import { routes } from "../routes"

function useDocumentTitle(route: string) {
  useEffect(() => {
    const match = routes.find((candidate) => candidate.path === route)
    if (match) document.title = match.title
  }, [route])
}

export { useDocumentTitle }
