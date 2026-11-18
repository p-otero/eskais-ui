import { Tree } from "@/components/ui/tree"

const paths = [
  "src/index.ts",
  "src/lib/format.ts",
  "src/lib/parse.ts",
  "src/routes/home.tsx",
  "public/logo.svg",
  "tests/",
  "package.json",
  "README.md",
]

export default function TreeDemo() {
  return (
    <Tree
      aria-label="Project files"
      paths={paths}
      defaultExpanded={["src", "src/lib"]}
      defaultValue="src/lib/format.ts"
      className="w-full max-w-xs"
    />
  )
}
