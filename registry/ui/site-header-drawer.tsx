"use client"

import { useId, useState } from "react"
import { MenuIcon, XIcon } from "lucide-react"

import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import {
  linkTarget,
  SiteHeaderPanelLinks,
  type SiteHeaderItem,
  type SiteHeaderRenderLink,
} from "@/components/ui/site-header-links"

type SiteHeaderDrawerProps = {
  label: string
  title: string
  items: SiteHeaderItem[]
  renderLink?: SiteHeaderRenderLink
  menuLabel: string
  closeLabel: string
}

function SiteHeaderGroup({ item, renderLink }: { item: SiteHeaderItem; renderLink?: SiteHeaderRenderLink }) {
  const labelId = useId()
  return (
    <NavigationMenuItem className="flex w-full flex-col gap-inline not-first:pt-group not-last:pb-group">
      <span id={labelId} className="px-inset-item text-caption font-medium text-muted-foreground">
        {item.label}
      </span>
      <SiteHeaderPanelLinks items={item.items ?? []} renderLink={renderLink} aria-labelledby={labelId} />
    </NavigationMenuItem>
  )
}

function SiteHeaderDrawer({ label, title, items, renderLink, menuLabel, closeLabel }: SiteHeaderDrawerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Drawer side="end" open={open} onOpenChange={setOpen}>
      <DrawerTrigger variant="ghost" size="icon" aria-label={menuLabel} className="hidden narrow:inline-flex">
        <MenuIcon />
      </DrawerTrigger>
      <DrawerBackdrop />
      <DrawerContent
        className="gap-group p-items"
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false)
        }}
      >
        <div className="flex items-center gap-inline">
          <DrawerTitle className="flex-1 truncate px-inset-item text-title-sm">{title}</DrawerTitle>
          <DrawerClose variant="ghost" size="icon" aria-label={closeLabel}>
            <XIcon />
          </DrawerClose>
        </div>
        <NavigationMenu aria-label={label} orientation="vertical" className="w-full max-w-none">
          <NavigationMenuList className="w-full gap-px">
            {items.map((item) =>
              item.items ? (
                <SiteHeaderGroup key={item.label} item={item} renderLink={renderLink} />
              ) : (
                <NavigationMenuItem key={item.label} className="w-full">
                  <NavigationMenuLink
                    {...linkTarget(item, renderLink)}
                    current={item.current}
                    variant="top"
                    className="w-full justify-start px-inset-item pointer-coarse:h-(--control-height-touch)"
                  >
                    {item.label}
                  </NavigationMenuLink>
                </NavigationMenuItem>
              ),
            )}
          </NavigationMenuList>
        </NavigationMenu>
      </DrawerContent>
    </Drawer>
  )
}

export { SiteHeaderDrawer }
export type { SiteHeaderDrawerProps }
