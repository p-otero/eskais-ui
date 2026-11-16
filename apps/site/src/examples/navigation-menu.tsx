import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"

const agentLinks = [
  { href: "#planner", title: "Planner", description: "Splits work into tasks." },
  { href: "#reviewer", title: "Reviewer", description: "Checks results against acceptance." },
]

export default function NavigationMenuDemo() {
  return (
    <NavigationMenu aria-label="Product">
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
          <NavigationMenuLink href="#guides" current variant="top">
            Guides
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}
