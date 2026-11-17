import { useState } from "react"

import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@/components/ui/accordion"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ButtonLink } from "@/components/ui/button-link"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Link } from "@/components/ui/link"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { Pagination } from "@/components/ui/pagination"
import { toast } from "@/components/ui/toast"

import { Section } from "../section"
import { Palette } from "./navigation-palette"

const faq = [
  { value: "limits", title: "What are the rate limits?", body: "Each agent gets 60 requests a minute; bursts queue." },
  {
    value: "retries",
    title: "When does a task retry?",
    body: "After a failure, up to three attempts, then it waits for a person.",
  },
]

const agentLinks = [
  { href: "#planner", title: "Planner", description: "Splits work into tasks." },
  { href: "#reviewer", title: "Reviewer", description: "Checks results against acceptance." },
]

function NavigationSection() {
  const [page, setPage] = useState(3)
  return (
    <Section
      title="Navigation"
      description="Links that follow on press, breadcrumb, navigation menu, menubar, context menu, hover card, accordion, pagination and a ⌘K palette."
    >
      <div className="flex w-full flex-col gap-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#projects">Projects</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#apollo">Apollo</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Index the docs</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <NavigationMenu aria-label="Site">
          <NavigationMenuList>
            <NavigationMenuItem value="agents">
              <NavigationMenuTrigger>Agents</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="m-0 grid w-64 list-none p-0">
                  {agentLinks.map((link) => (
                    <li key={link.href}>
                      <NavigationMenuLink href={link.href}>
                        <span className="font-medium">{link.title}</span>
                        <span className="text-muted-foreground">{link.description}</span>
                      </NavigationMenuLink>
                    </li>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink href="#navigation" current variant="top">
                Guides
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div data-testid="fast-links" className="flex flex-wrap items-center gap-3 text-sm">
          <p>
            Open the <Link href="?demo=site">site demo</Link> or the{" "}
            <Link href="?demo=shell" fast={false}>
              shell demo (follows on release)
            </Link>
            .
          </p>
          <ButtonLink href="?demo=page" size="sm" variant="outline">
            Page demo
          </ButtonLink>
          <p>
            In a hash router, a <Link href="#/demo/hash-route">hash route</Link> follows on press too, while an{" "}
            <Link href="#navigation">in-page anchor</Link> stays native.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Menubar aria-label="Board menu">
            <MenubarMenu onAction={(value) => toast.success(`Chose ${value}`)}>
              <MenubarTrigger>File</MenubarTrigger>
              <MenubarContent>
                <MenubarItem value="new task" shortcut="mod+alt+n">
                  New task
                  <MenubarShortcut />
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem value="export">Export board</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
            <MenubarMenu onAction={(value) => toast.success(`Chose ${value}`)}>
              <MenubarTrigger>View</MenubarTrigger>
              <MenubarContent>
                <MenubarItem value="zoom">Zoom to fit</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
          <Palette />
        </div>

        <ContextMenu onAction={(value) => toast.success(`Chose ${value}`)}>
          <ContextMenuTrigger aria-label="Task Write the changelog" variant="area">
            Right-click, long-press or press Shift+F10 on Write the changelog
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem value="copy id">Copy task id</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem value="discard" destructive data-agent-confirm="Discards the Write the changelog task">
              Discard task
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <p className="text-sm">
          Reviewed by{" "}
          <HoverCard>
            <HoverCardTrigger href="#reviewer">reviewer</HoverCardTrigger>
            <HoverCardContent>
              <p className="font-medium">Reviewer agent</p>
              <p className="text-muted-foreground">Checks each result against its acceptance criteria.</p>
            </HoverCardContent>
          </HoverCard>
        </p>

        <Accordion aria-label="Task questions" defaultValue={["limits"]} className="max-w-lg">
          {faq.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionHeader>
                <AccordionTrigger>{item.title}</AccordionTrigger>
              </AccordionHeader>
              <AccordionPanel>{item.body}</AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>

        <Pagination aria-label="Task pages" page={page} pageCount={12} onPageChange={setPage} />
      </div>
    </Section>
  )
}

export { NavigationSection }
