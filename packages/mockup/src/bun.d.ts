type MockupBuildLoader = "dataurl"

type MockupBuildResolve = { path: string } | { errors: { message: string }[] } | undefined

type MockupBuildPlugin = {
  name: string
  setup(build: {
    onResolve(
      options: { filter: RegExp },
      callback: (args: { path: string; importer?: string; resolveDir?: string }) => MockupBuildResolve,
    ): void
  }): void
}

type MockupBuildOptions = {
  entrypoints: string[]
  outdir: string
  target: "browser"
  format: "esm"
  minify: boolean
  sourcemap: "external"
  define: Record<string, string>
  loader: Record<string, MockupBuildLoader>
  plugins: MockupBuildPlugin[]
}

type MockupBuildOutput = {
  path: string
  kind: string
  size: number
}

type MockupBuildResult = {
  success: boolean
  outputs: MockupBuildOutput[]
  logs: { level: string; message: string }[]
}

declare const Bun: {
  build(options: MockupBuildOptions): Promise<MockupBuildResult>
  plugin(plugin: MockupBuildPlugin): void
  resolveSync(specifier: string, from: string): string
}
