import { lazy, Suspense } from "react"

import { Appearance } from "@/components/ui/appearance"
import { SkipLink } from "@/components/ui/skip-link"
import { Spinner } from "@/components/ui/spinner"
import { ToastStack } from "@/components/ui/toast"

import { AgentApproval } from "./agent"
import { appearance } from "./appearance"
import { SiteHeader } from "./header"
import { useDocumentTitle } from "./hooks/use-document-title"
import { useRoute } from "./router"

const Landing = lazy(() => import("./landing/landing").then((module) => ({ default: module.Landing })))
const DocsRoutes = lazy(() => import("./docs/docs-routes").then((module) => ({ default: module.DocsRoutes })))
const NotFound = lazy(() => import("./not-found").then((module) => ({ default: module.NotFound })))

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-section">
      <Spinner label="Loading page" />
    </div>
  )
}

function Page({ route }: { route: string }) {
  if (route === "/") return <Landing />
  if (route === "/docs" || route.startsWith("/docs/")) return <DocsRoutes route={route} />
  return <NotFound />
}

function App() {
  const route = useRoute()
  useDocumentTitle(route)
  return (
    <Appearance appearance={appearance}>
      <SkipLink>Skip to content</SkipLink>
      <div data-slot="site" className="flex min-h-full flex-col pt-floating">
        <SiteHeader />
        <Suspense fallback={<Loading />}>
          <Page route={route} />
        </Suspense>
      </div>
      <ToastStack />
      <AgentApproval />
    </Appearance>
  )
}

export { App }
