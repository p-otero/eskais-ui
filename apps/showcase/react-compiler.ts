import { relative } from "node:path"
import { fileURLToPath } from "node:url"

import babel from "@rolldown/plugin-babel"
import { reactCompilerPreset } from "@vitejs/plugin-react"
import type { Logger } from "babel-plugin-react-compiler"
import type { PluginOption } from "vite"

const root = fileURLToPath(new URL("../..", import.meta.url))

const allowed = [
  {
    file: "registry/ui/use-last-success.ts",
    category: "Refs",
    reason: "reads its ref while rendering on purpose; the compiler skips the hook and DataState still compiles",
  },
]

function reactCompiler(): PluginOption[] {
  const compiled = new Set<string>()
  const problems: string[] = []
  const skipped: string[] = []
  const logger: Logger = {
    logEvent(filename, event) {
      const file = relative(root, filename ?? "").replaceAll("\\", "/")
      if (!file.startsWith("registry/")) return
      if (event.kind === "CompileSuccess") {
        compiled.add(file)
        return
      }
      if (event.kind !== "CompileError" && event.kind !== "PipelineError") return
      const category = event.kind === "CompileError" ? event.detail.category : "Pipeline"
      const reason = event.kind === "CompileError" ? event.detail.reason : event.data
      const line = event.fnLoc?.start.line ?? 0
      const entry = `${file}:${String(line)} ${category}: ${reason}`
      const known = allowed.find((item) => item.file === file && item.category === category)
      if (known) skipped.push(`${entry} (allowed: ${known.reason})`)
      else problems.push(entry)
    },
  }
  return [
    babel({ presets: [reactCompilerPreset({ logger })] }),
    {
      name: "eskais:react-compiler-report",
      apply: "build",
      buildEnd() {
        for (const entry of new Set(skipped)) this.warn(`React Compiler skipped ${entry}`)
        if (problems.length > 0) {
          this.error(`React Compiler can't compile:\n${[...new Set(problems)].join("\n")}`)
        }
        if (compiled.size === 0) this.error("React Compiler compiled no registry file.")
        this.info(`React Compiler compiled ${String(compiled.size)} registry files.`)
      },
    },
  ]
}

export { reactCompiler }
