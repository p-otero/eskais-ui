import { MoonIcon, SunIcon } from "lucide-react"
import { usePreference } from "@ui-sdk/react/preferences"
import type { ReactNode } from "react"
import { ButtonLink } from "@/components/ui/button-link"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { Link } from "@/components/ui/link"
import { Toggle } from "@/components/ui/toggle"
import { Topbar } from "@/components/ui/topbar"

import { appearance } from "./appearance"
import { categories } from "./content/categories"
import { GithubIcon, Logo } from "./icons"
import { followTo, linkTo, useRoute } from "./router"
import { SiteSearch } from "./search"

const repositoryUrl = "https://github.com/p-otero/eskais-ui"

const categoryBlurbs: Record<string, string> = {
  Foundations: "Appearance, tone, buttons and the small parts.",
  Forms: "Form, fields and every input, bound by name.",
  Overlays: "Dialogs, drawers, menus, popovers, ⌘K.",
  Navigation: "Sidebar, menus, tabs, breadcrumbs.",
  Layout: "Pages, sections, cards, boards.",
  Data: "Tables, charts, lists and values.",
  Feedback: "Alerts, toasts, states and progress.",
  "Agent tasks": "Threads, activity with undo, the board and proposals for AI agents.",
  Editor: "Code, Markdown editing and rendering.",
  Blocks: "Hero, bento, steps, footer and docs layout.",
}

const slug = (name: string) => name.toLowerCase().replaceAll(" ", "-")

function ColorSchemeToggle() {
  const dark = usePreference(appearance.colorScheme).resolved === "dark"
  return (
    <Toggle
      size="icon"
      aria-label="Dark mode"
      pressed={dark}
      onPressedChange={(pressed) => appearance.colorScheme.set(pressed ? "dark" : "light")}
    >
      {dark ? <MoonIcon /> : <SunIcon />}
    </Toggle>
  )
}

function Brand() {
  return (
    <Link
      {...followTo("/")}
      variant="plain"
      className="flex shrink-0 items-center gap-inline rounded-control px-inset-item text-title-sm tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Logo aria-hidden className="size-6" />
      <span>Eskais UI</span>
    </Link>
  )
}

function MainNav({ className }: { className?: string }) {
  const route = useRoute()
  const inDocs = route.startsWith("/docs")
  return (
    <NavigationMenu aria-label="Main" className={className}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink
            variant="top"
            current={inDocs && !route.startsWith("/docs/components") && route !== "/docs/theming"}
            {...linkTo("/docs/installation")}
          >
            Docs
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem value="components">
          <NavigationMenuTrigger>Components</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="m-0 grid w-xl list-none grid-cols-2 p-0">
              {categories.map((category) => (
                <li key={category.name}>
                  <NavigationMenuLink {...linkTo(`/docs/components#${slug(category.name)}`)}>
                    <span className="font-medium">{category.name}</span>
                    <span className="text-body-sm text-muted-foreground">{categoryBlurbs[category.name]}</span>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink variant="top" current={route === "/docs/theming"} {...linkTo("/docs/theming")}>
            Theming
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

function HeaderActions({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-inline">
      {children}
      <SiteSearch />
      <ColorSchemeToggle />
      <ButtonLink variant="ghost" size="icon" href={repositoryUrl} aria-label="Eskais UI on GitHub">
        <GithubIcon />
      </ButtonLink>
    </div>
  )
}

/**
 * Docs pages pass their sidebar's `trigger`, which opens the navigation below lg; without one, a Docs link stands in.
 */
function SiteTopbar({ trigger }: { trigger?: ReactNode }) {
  return (
    <Topbar
      className="*:data-[slot=topbar-trailing]:flex-none"
      leading={
        <>
          {trigger}
          <Brand />
          <MainNav className="max-lg:hidden" />
        </>
      }
      trailing={
        <HeaderActions>
          {trigger === undefined && (
            <ButtonLink variant="ghost" className="lg:hidden" {...linkTo("/docs/installation")}>
              Docs
            </ButtonLink>
          )}
        </HeaderActions>
      }
    />
  )
}

export { repositoryUrl, SiteTopbar, slug }
