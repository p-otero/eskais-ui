import { DataTable, type DataTableColumn } from "@/components/ui/data-table"

type Issue = { id: string; title: string; summary: string }

const issues: Issue[] = [
  {
    id: "ENG-412",
    title: "Webhook retries stop after the first timeout on every endpoint",
    summary: "Retries stop once the first attempt times out, so a slow endpoint never gets a second chance to answer.",
  },
  { id: "ENG-415", title: "Audit log export", summary: "Exports miss rows past 10,000." },
]

const columns: DataTableColumn<Issue>[] = [
  { id: "id", header: "ID", cell: (row) => row.id, cellClassName: "font-mono" },
  { id: "title", header: "Title", cell: (row) => row.title, cellClassName: "max-w-48" },
  { id: "summary", header: "Summary", cell: (row) => row.summary, wrap: true },
]

function TableCheck() {
  return (
    <main className="p-section">
      <div data-testid="table" className="w-160">
        <DataTable
          label="Issues"
          rows={issues}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.title}
        />
      </div>
    </main>
  )
}

export { TableCheck }
