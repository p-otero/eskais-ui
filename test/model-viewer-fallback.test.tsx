import { act, render, screen } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"

import { ModelViewer } from "@/components/ui/model-viewer"

import { axeViolations } from "./axe"
import { fakeScene } from "./fixtures/model/fake-scene"

vi.mock("@/components/ui/model-viewer-scene", () => import("./fixtures/model/fake-scene"))

// The test setup's canvas has no context, as in a browser without WebGL.
test("without WebGL the poster stays with a message, the scene never loads, and agents hear why", async () => {
  const agent = createAgent()
  render(
    <main>
      <ModelViewer model="figure.glb" alt="A stylised figure" poster="poster.png" />
    </main>,
  )
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  const root = document.querySelector('[data-slot="model-viewer"]')
  expect(root?.getAttribute("data-status")).toBe("unsupported")
  expect(screen.getByText("3D isn't available in this browser.")).toBeTruthy()
  expect(document.querySelector('[data-slot="model-viewer-poster"] img')?.getAttribute("src")).toBe("poster.png")
  expect(screen.queryByTestId("fake-scene")).toBeNull()
  expect(fakeScene.renders).toBe(0)
  expect(screen.queryByRole("group", { name: "3D view controls" })).toBeNull()
  const result = await agent.act({ steps: [{ ref: "A stylised figure", action: "rotate", args: [10] }] })
  expect(result.error?.message).toContain("rotate works once the model has loaded (status: unsupported).")
  expect(await axeViolations(document.body)).toEqual([])
})
