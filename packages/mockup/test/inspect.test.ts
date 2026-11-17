import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, test } from "vitest"

import { componentDetail, detailText, extractCva, extractType, indexText, readExports } from "../src/inspect"
import type { MockupProject } from "../src/project"

const source = `import { cva } from "class-variance-authority"

export const buttonVariants = cva("base", {
  variants: { size: { sm: "h-8", lg: "h-10" } },
  defaultVariants: { size: "sm" },
})

type ButtonProps = {
  size?: "sm" | "lg"
  icon?: ReactNode
}

type Alias = Omit<ButtonProps, "size"> & { extra: boolean }

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  surface?: "elevated" | "flat"
}

export function Button({ size }: ButtonProps) {
  return <button data-size={size} />
}

export const BUTTON_SIZES = ["sm", "lg"] as const
export type { ButtonProps }
`

describe("readExports", () => {
  test("lists declarations and re-exports in source order", () => {
    expect(readExports(source)).toEqual([
      { name: "buttonVariants", kind: "value" },
      { name: "CardProps", kind: "type" },
      { name: "Button", kind: "value" },
      { name: "BUTTON_SIZES", kind: "value" },
      { name: "ButtonProps", kind: "type" },
    ])
  })

  test("keeps a name once when it is declared and re-exported", () => {
    const names = readExports("export function Badge() {}\nexport { Badge }\n").map((entry) => entry.name)
    expect(names).toEqual(["Badge"])
  })

  test("reads a curly list of re-exports, with aliases and types", () => {
    expect(readExports('export { Button, buttonVariants as variants, type ButtonProps } from "./button"\n')).toEqual([
      { name: "Button", kind: "value" },
      { name: "variants", kind: "value" },
      { name: "ButtonProps", kind: "type" },
    ])
  })
})

describe("extractType", () => {
  test("reads a type literal through its closing brace", () => {
    expect(extractType(source, "ButtonProps")).toBe(
      ["type ButtonProps = {", '  size?: "sm" | "lg"', "  icon?: ReactNode", "}"].join("\n"),
    )
  })

  test("reads a one-line type alias up to the newline", () => {
    expect(extractType(source, "Alias")).toBe('type Alias = Omit<ButtonProps, "size"> & { extra: boolean }')
  })

  test("reads an interface through its closing brace", () => {
    expect(extractType(source, "CardProps")).toBe(
      ["interface CardProps extends HTMLAttributes<HTMLDivElement> {", '  surface?: "elevated" | "flat"', "}"].join(
        "\n",
      ),
    )
  })

  test("returns null for a type the file does not declare", () => {
    expect(extractType(source, "MissingProps")).toBeNull()
  })
})

describe("extractCva", () => {
  test("reads the whole call, nested objects included", () => {
    const variants = extractCva(source)
    expect(variants.map((variant) => variant.name)).toEqual(["buttonVariants"])
    expect(variants[0]?.text).toContain('defaultVariants: { size: "sm" }')
    expect(variants[0]?.text.endsWith(")")).toBe(true)
  })

  test("reads every call in the file", () => {
    expect(
      extractCva('const a = cva("a")\nconst b = cva("b", { variants: {} })\n').map((variant) => variant.name),
    ).toEqual(["a", "b"])
  })
})

describe("a project's aliases", () => {
  const root = mkdtempSync(join(tmpdir(), "mockup-inspect-"))
  const ui = join(root, "registry", "ui")
  mkdirSync(ui, { recursive: true })
  writeFileSync(
    join(ui, "button.tsx"),
    'import { cva } from "class-variance-authority"\n\nconst buttonVariants = cva("base", { variants: { size: { sm: "h-8" } } })\n\ntype ButtonProps = {\n  size?: "sm"\n}\n\nfunction Button({ size }: ButtonProps) {\n  return null\n}\n\nexport { Button, buttonVariants }\nexport type { ButtonProps }\n',
  )
  writeFileSync(join(ui, "card.tsx"), "function Card() {\n  return null\n}\n\nexport { Card }\n")
  writeFileSync(join(root, "theme.css"), '@import "./palette.css";\n[data-theme="compact"] { --radius: 4px; }\n')
  writeFileSync(join(root, "palette.css"), '[data-theme="glass"] { --glass-blur: 1rem; }\n')
  const project: MockupProject = {
    root,
    css: join(root, "theme.css"),
    tsconfig: join(root, "tsconfig.json"),
    entry: null,
    aliases: [{ name: "ui", specifier: "@/components/ui", dir: ui }],
    pathPrefixes: ["@/"],
    registries: {},
    dependencies: new Set(["react"]),
    runtime: {
      tailwindNode: "",
      tailwindOxide: "",
      react: "",
      reactServer: "",
      tailwindVersion: "4.3.5",
      reactVersion: "19.3.1",
    },
  }

  afterAll(() => rmSync(root, { recursive: true, force: true }))

  test("the compact index lists the files, their exports and the themes the css imports", () => {
    const index = indexText(project, root).split("\n")
    expect(index.slice(0, 7)).toEqual([
      "project .",
      "css theme.css",
      "tailwind 4.3.5  react 19.3.1",
      "entry none",
      "providers none",
      "themes compact, default, glass",
      "wrapper none",
    ])
    expect(index).toContain("  button Button, buttonVariants")
    expect(index).toContain("  card Card")
  })

  test("a name prints its import line, props type and variants", () => {
    const detail = componentDetail(project, "Button")
    expect(detail.specifier).toBe("@/components/ui/button")
    expect(detail.props).toBe('type ButtonProps = {\n  size?: "sm"\n}')
    const text = detailText(detail, root)
    expect(text).toContain('import { Button, buttonVariants } from "@/components/ui/button"')
    expect(text).toContain('import type { ButtonProps } from "@/components/ui/button"')
    expect(text).toContain("const buttonVariants = cva(")
  })

  test("a component without props still prints its import line", () => {
    const detail = componentDetail(project, "Card")
    expect(detail.props).toBeNull()
    expect(detail.importLine).toBe('import { Card } from "@/components/ui/card"')
  })

  test("an unknown name is an environment error", () => {
    expect(() => componentDetail(project, "Nope")).toThrowError(/exports Nope/)
  })
})
