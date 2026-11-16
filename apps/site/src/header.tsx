import { MoonIcon, SunIcon } from "lucide-react"
import { usePreference } from "@ui-sdk/react/preferences"
import { ButtonLink } from "@/components/ui/button-link"
import { Floating, FloatingContent } from "@/components/ui/floating"
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
  "Agent tasks": "The board, cards and proposals for AI agents.",
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

function SiteHeader() {
  const route = useRoute()
  const inDocs = route.startsWith("/docs")
  return (
    // Composed from NavigationMenu and Floating until the registry ships a SiteHeader; switch to it once it lands.
    <Floating side="top" className="w-full">
      <FloatingContent className="w-full max-w-6xl">
        <header className="flex w-full min-w-0 items-center justify-between gap-items">
          <Link
            {...followTo("/")}
            variant="plain"
            className="flex shrink-0 items-center gap-inline rounded-control px-inset-item text-title-sm tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo className="size-6" />
            <span className="narrow:sr-only">Eskais UI</span>
          </Link>
          <NavigationMenu aria-label="Main" className="narrow:hidden">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink
                  variant="top"
                  current={inDocs && !route.startsWith("/docs/components")}
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
                <NavigationMenuLink variant="top" {...linkTo("/docs/theming")}>
                  Theming
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <div className="flex min-w-0 items-center gap-inline">
            <ButtonLink variant="ghost" className="hidden narrow:inline-flex" {...linkTo("/docs/installation")}>
              Docs
            </ButtonLink>
            <SiteSearch />
            <ColorSchemeToggle />
            <ButtonLink variant="ghost" size="icon" href={repositoryUrl} aria-label="Eskais UI on GitHub">
              <GithubIcon />
            </ButtonLink>
          </div>
        </header>
      </FloatingContent>
    </Floating>
  )
}

export { repositoryUrl, SiteHeader, slug }
