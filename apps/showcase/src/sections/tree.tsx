import { Tree, type TreeItemData } from "@/components/ui/tree"

import { Section } from "../section"

const paths = [
  "src/index.ts",
  "src/lib/format.ts",
  "src/lib/parse.ts",
  "src/routes/home.tsx",
  "public/logo.svg",
  "data/report.csv",
  "tests/",
  "package.json",
  "README.md",
]

const stack: TreeItemData[] = [
  {
    value: "frontend",
    label: "Frontend",
    children: [
      { value: "react", label: "React" },
      { value: "vue", label: "Vue" },
      { value: "svelte", label: "Svelte", disabled: true },
    ],
  },
  {
    value: "backend",
    label: "Backend",
    children: [
      { value: "node", label: "Node" },
      { value: "postgres", label: "Postgres" },
    ],
  },
]

function TreeSection() {
  return (
    <Section
      title="Tree"
      description="A file explorer from paths, with icons per node and guide lines, and a checkable tree with mixed branches."
    >
      <div data-tree-demo className="grid w-full gap-section md:grid-cols-2">
        <Tree
          aria-label="Project files"
          paths={paths}
          defaultExpanded={["src", "src/lib"]}
          defaultValue="src/lib/format.ts"
        />
        <Tree
          aria-label="Stack"
          items={stack}
          checkable
          mode="none"
          icon={false}
          defaultExpanded={["frontend", "backend"]}
          defaultChecked={["react"]}
        />
      </div>
    </Section>
  )
}

export { TreeSection }
