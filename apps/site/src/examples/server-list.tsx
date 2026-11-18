import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ListItem } from "@/components/ui/list-item"
import { ServerList } from "@/components/ui/server-list"
import { StatusPill } from "@/components/ui/status-pill"

import { serverTaskFilters, taskSource, type ServerTask } from "./fixtures"

const source = taskSource({ key: ["docs", "server-list"], delay: 350 })

const tone = { open: "info", in_progress: "violet", blocked: "warning", done: "success" } as const
const status = { open: "Open", in_progress: "In progress", blocked: "Blocked", done: "Done" } as const

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
}

export default function ServerListDemo() {
  return (
    <div className="flex h-96 w-full max-w-xl flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ServerList<ServerTask, typeof serverTaskFilters>
          aria-label="Tasks"
          source={source}
          filters={serverTaskFilters}
          pageSize={30}
          itemText={(task) => `${task.id} ${task.title}`}
          renderItem={(task) => (
            <ListItem
              id={task.id}
              title={task.title}
              subtitle={task.id}
              status={<StatusPill tone={tone[task.status]}>{status[task.status]}</StatusPill>}
              trailing={
                <Avatar className="size-6">
                  <AvatarFallback className="text-caption">{initials(task.assignee)}</AvatarFallback>
                </Avatar>
              }
              onSelect={() => {}}
            />
          )}
          labels={{ errorTitle: "Couldn't load tasks", retry: "Try again", emptyTitle: "No tasks match" }}
        />
      </div>
    </div>
  )
}
