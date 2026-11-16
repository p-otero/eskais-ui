import { DataTable, type DataTableColumn } from "@/components/ui/data-table"

type Deployment = { id: string; project: string; region: string; minutes: number | null }

const deployments: Deployment[] = [
  { id: "d1", project: "Apollo", region: "eu-west", minutes: 12 },
  { id: "d2", project: "Borealis", region: "us-east", minutes: 31 },
  { id: "d3", project: "Cygnus", region: "ap-south", minutes: null },
  { id: "d4", project: "Draco", region: "eu-west", minutes: 7 },
  { id: "d5", project: "Eridanus", region: "us-east", minutes: 44 },
  { id: "d6", project: "Fornax", region: "ap-south", minutes: 19 },
  { id: "d7", project: "Gemini", region: "eu-west", minutes: 3 },
]

const columns: DataTableColumn<Deployment>[] = [
  { id: "project", header: "Project", cell: (row) => row.project, sortValue: (row) => row.project },
  { id: "region", header: "Region", cell: (row) => row.region, sortValue: (row) => row.region },
  {
    id: "minutes",
    header: "Build minutes",
    cell: (row) => row.minutes ?? "—",
    sortValue: (row) => row.minutes,
    align: "end",
  },
]

export default function DataTableDemo() {
  return (
    <DataTable
      label="Deployments"
      rows={deployments}
      columns={columns}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.project}
      selectable
      pageSize={5}
      className="w-full"
    />
  )
}
