import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const tasks = [
  { id: "t1", title: "Draft the release notes for every package in the workspace", owner: "Ada", done: false },
  { id: "t2", title: "Review the agent approval flow", owner: "Grace", done: true },
  { id: "t3", title: "Audit contrast in the glass theme", owner: "Linus", done: false },
]

export default function TableDemo() {
  return (
    <Table aria-label="Tasks" className="min-w-lg">
      <TableCaption>Three tasks this week.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <TableRow key={task.id}>
            <TableCell className="max-w-56" title={task.title}>
              {task.title}
            </TableCell>
            <TableCell>{task.owner}</TableCell>
            <TableCell>
              <Badge tone={task.done ? "success" : "info"}>{task.done ? "Done" : "In progress"}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
