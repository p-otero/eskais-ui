import { SiteFooter } from "@/components/ui/site-footer"

import { repositoryUrl } from "../header"
import { Logo } from "../icons"
import { linkTo } from "../router"

const groups = [
  {
    title: "Docs",
    links: [
      { label: "Installation", ...linkTo("/docs/installation") },
      { label: "Theming", ...linkTo("/docs/theming") },
      { label: "Agents", ...linkTo("/docs/agents") },
      { label: "Accessibility", ...linkTo("/docs/accessibility") },
    ],
  },
  {
    title: "Components",
    links: [
      { label: "Form", ...linkTo("/docs/components/form") },
      { label: "AgentTaskBoard", ...linkTo("/docs/components/agent-task-board") },
      { label: "MarkdownEditor", ...linkTo("/docs/components/markdown-editor") },
      { label: "All components", ...linkTo("/docs/components") },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: repositoryUrl, external: true },
      { label: "UI SDK docs", href: "https://ui-sdk.dev/docs", external: true },
    ],
  },
]

function Footer() {
  return (
    <SiteFooter
      className="mt-auto bg-background/60"
      brand={
        <>
          <Logo className="size-6" />
          Eskais UI
        </>
      }
      description="Agent-native, accessible React components on Vercel UI SDK. Open source under the MIT license."
      groups={groups}
      bottom="Built with Eskais UI. Every control on this site is a registry component."
    />
  )
}

export { Footer }
