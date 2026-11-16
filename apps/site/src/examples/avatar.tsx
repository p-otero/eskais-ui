import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const people = [
  { initials: "AL", name: "Ada Lovelace" },
  { initials: "GH", name: "Grace Hopper" },
  { initials: "LT", name: "Linus Torvalds" },
]

export default function AvatarDemo() {
  return (
    <ul className="flex flex-wrap gap-group text-body-sm">
      {people.map((person) => (
        <li key={person.initials} className="flex items-center gap-inline">
          <Avatar size="sm" aria-hidden="true">
            <AvatarFallback>{person.initials}</AvatarFallback>
          </Avatar>
          {person.name}
        </li>
      ))}
    </ul>
  )
}
