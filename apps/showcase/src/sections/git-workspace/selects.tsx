import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { RepositorySelect, type Repository, type RepositorySelectProps } from "@/components/ui/repository-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { WORKSPACE, type BranchRef, type Repo } from "../git-workspace-fixtures"

function repositoriesOf(repos: readonly Repo[]): Repository[] {
  return repos.map((repo) => ({
    value: repo.id,
    name: repo.path,
    path: `${WORKSPACE}/${repo.path}`,
    branch: repo.branch,
    uncommitted: repo.dirty,
    ahead: repo.ahead,
    behind: repo.behind,
    remote: repo.remote !== null,
  }))
}

type RepositoryFieldProps = Omit<RepositorySelectProps, "repositories"> & { repos: readonly Repo[] }

function RepositoryField({ repos, ...props }: RepositoryFieldProps) {
  return (
    <Field className="max-w-72 min-w-52">
      <FieldLabel>Repository</FieldLabel>
      <RepositorySelect repositories={repositoriesOf(repos)} {...props} />
    </Field>
  )
}

type BranchFieldProps = {
  branches: readonly BranchRef[]
  value: string
  onChange: (branch: string) => void
  base: string
}

function BranchField({ branches, value, onChange, base }: BranchFieldProps) {
  const items = branches.map((branch) => ({ value: branch.name, label: branch.name }))
  return (
    <Field className="max-w-72 min-w-52">
      <FieldLabel>Branch</FieldLabel>
      <Select
        items={items}
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next)
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-80">
          {branches.map((branch) => (
            <SelectItem key={branch.name} value={branch.name} label={branch.name}>
              <span className="min-w-0 flex-1 truncate font-mono text-body-sm">{branch.name}</span>
              {branch.name === base ? (
                <Badge variant="secondary">base</Badge>
              ) : (
                <span className="text-caption text-muted-foreground tabular-nums">
                  {branch.ahead} ahead · {branch.behind} behind
                </span>
              )}
              {branch.pushed ? null : <Badge tone="warning">Local only</Badge>}
              <SelectItemIndicator />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export { BranchField, repositoriesOf, RepositoryField }
