import { useState } from "react"

import { RepositorySelect, type Repository } from "@/components/ui/repository-select"

const repositories: Repository[] = [
  {
    value: "api",
    name: "api",
    path: "~/work/acme/api",
    branch: "main",
    uncommitted: 0,
    ahead: 0,
    behind: 0,
    remote: true,
  },
  {
    value: "app",
    name: "app",
    path: "~/work/acme/app",
    branch: "feat/onboarding-steps",
    uncommitted: 5,
    ahead: 2,
    behind: 7,
    remote: true,
  },
  {
    value: "docs",
    name: "docs",
    path: "~/work/acme/docs",
    branch: "main",
    uncommitted: 1,
    ahead: null,
    behind: null,
    remote: false,
  },
  {
    value: "cli",
    name: "tools/cli",
    path: "~/work/acme/tools/cli",
    branch: "release/0.9",
    ahead: 3,
    behind: 0,
    remote: true,
  },
]

export default function RepositorySelectDemo() {
  const [repository, setRepository] = useState<string | null>("api")
  return (
    <div className="w-56">
      <RepositorySelect
        aria-label="Repository"
        repositories={repositories}
        value={repository}
        onValueChange={setRepository}
      />
    </div>
  )
}
