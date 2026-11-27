import { readFileSync } from "node:fs"

import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { PerspectiveCamera, Vector3 } from "three"
import { afterEach, expect, test, vi } from "vitest"

import { Button } from "@/components/ui/button"
import { SafeVault, type SafeVaultStatus } from "@/components/ui/safe-vault"
import { environmentCubeSize, shadowMapSize } from "@/components/ui/safe-vault-scene"
import { safeTextureSizes } from "@/components/ui/safe-vault-textures"
import {
  lockedPose,
  lockMs,
  motionDone,
  motionTowards,
  openDegrees,
  poseAt,
  unlockedPose,
  unlockMs,
} from "@/components/ui/safe-vault-timeline"
import {
  applyMatrix,
  cameraFovDegrees,
  cameraPosition,
  framingFor,
  planeMatrix,
  plaqueCorners,
  plaqueHeightFor,
  plaqueMaxHeight,
  plaqueMinHeight,
  polygonArea,
  projection,
  settledFraming,
  visibleOpening,
} from "@/components/ui/safe-vault-view"
import { createVaultMotion } from "@/components/ui/use-safe-vault-motion"
import { parseActionRefusal } from "@/lib/action-refusal"

import { axeViolations } from "./axe"

const agent = createAgent()
let reduced = false

window.matchMedia = ((media: string) => ({
  matches: media.includes("reduce") && reduced,
  media,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
})) as unknown as typeof window.matchMedia

afterEach(() => {
  reduced = false
  vi.useRealTimers()
})

const combination = "27461333"
const code = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Combination" })
const contents = () => document.querySelector<HTMLElement>('[data-slot="safe-vault-contents"]')

const snapshotText = () => JSON.stringify(agent.snapshot())

async function enter(digits: string) {
  const user = userEvent.setup({ delay: null })
  screen.getByRole("slider", { name: "Dial" }).focus()
  await user.keyboard(digits)
  await act(async () => {})
}

function App({ onStatusChange }: { onStatusChange?: (status: SafeVaultStatus) => void }) {
  const [status, setStatus] = useState<SafeVaultStatus>("locked")
  return (
    <SafeVault
      label="Vault"
      status={status}
      onStatusChange={(next, details) => {
        onStatusChange?.(next)
        if (details.reason === "lock" || details.reason === "retry") setStatus(next)
      }}
      onComplete={(entered) => setStatus(entered === combination ? "unlocked" : "denied")}
    >
      <p>esk_demo_key</p>
      <Button>Copy</Button>
    </SafeVault>
  )
}

test("the vault renders on the server with its dial and without its contents", () => {
  const html = renderToString(
    <SafeVault label="Vault" status="locked">
      <p>esk_demo_key</p>
    </SafeVault>,
  )
  expect(html).toContain('data-slot="safe-vault"')
  expect(html).toContain('data-slot="safe-dial-dial"')
  expect(html).not.toContain("esk_demo_key")
  expect(html).not.toContain("<canvas")
})

test("the contents aren't in the page while locked, and open in a named region once unlocked", async () => {
  render(<App />)
  expect(screen.queryByText("esk_demo_key")).toBeNull()
  expect(contents()).toHaveProperty("hidden", true)
  await enter(combination)
  const region = screen.getByRole("region", { name: "Vault contents" })
  expect(region.textContent).toContain("esk_demo_key")
  expect(region.hasAttribute("inert")).toBe(false)
  expect(screen.getByRole("status").textContent).toBe("Unlocked")
})

test("a denied code shakes, is announced, clears and asks to lock again once the shake has played", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true })
  const onStatusChange = vi.fn()
  render(<App onStatusChange={onStatusChange} />)
  await enter("11223344")
  expect(screen.getByRole("status").textContent).toBe("Wrong combination")
  expect(document.querySelector('[data-slot="safe-vault"]')?.getAttribute("data-status")).toBe("denied")
  expect(code().value).toBe("11223344")
  await act(async () => {
    vi.advanceTimersByTime(400)
  })
  expect(onStatusChange).not.toHaveBeenCalled()
  await act(async () => {
    vi.advanceTimersByTime(120)
  })
  expect(onStatusChange).toHaveBeenCalledWith("locked")
  expect(code().value).toBe("")
  expect(screen.queryByText("esk_demo_key")).toBeNull()
})

test("under reduced motion a denied code clears at once", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true })
  reduced = true
  const onStatusChange = vi.fn()
  render(<App onStatusChange={onStatusChange} />)
  await enter("11223344")
  await act(async () => {
    vi.advanceTimersByTime(0)
  })
  expect(onStatusChange).toHaveBeenCalledWith("locked")
  expect(code().value).toBe("")
})

test("Lock asks for locked, the contents leave the page and the code clears", async () => {
  const onStatusChange = vi.fn()
  render(<App onStatusChange={onStatusChange} />)
  await enter(combination)
  fireEvent.click(screen.getByRole("button", { name: "Lock" }))
  await act(async () => {})
  expect(onStatusChange).toHaveBeenCalledWith("locked")
  expect(screen.queryByText("esk_demo_key")).toBeNull()
  expect(screen.queryByRole("button", { name: "Lock" })).toBeNull()
  expect(code().value).toBe("")
})

test("with the 3D safe, the contents stay inert until the door has opened, and a lock mid-way turns back", () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  const motion = createVaultMotion("locked")
  motion.setRenderer(true)
  motion.setStatus("unlocked")
  expect(motion.snapshot()).toMatchObject({ open: false, motion: { kind: "unlocking" } })
  vi.advanceTimersByTime(unlockMs - 1)
  expect(motion.snapshot().open).toBe(false)
  vi.advanceTimersByTime(1)
  expect(motion.snapshot().open).toBe(true)
  motion.setStatus("locked")
  expect(motion.snapshot()).toMatchObject({ open: false, motion: { kind: "locking" } })
  motion.dispose()

  const reducedMotion = createVaultMotion("locked")
  reduced = true
  reducedMotion.setRenderer(true)
  reducedMotion.setStatus("unlocked")
  expect(reducedMotion.snapshot()).toMatchObject({ open: true, motion: { kind: "unlocked" } })
  reducedMotion.dispose()
})

test("an agent enters the combination through the vault, and reads the contents only once it's unlocked", async () => {
  render(<App />)
  expect(snapshotText()).not.toContain("Copy")
  let result = await act(() => agent.act({ steps: [{ ref: "Vault", action: "enter", args: ["11-22"] }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "enter", kind: "unavailable" })
  result = await act(() => agent.act({ steps: [{ ref: "Vault", action: "enter", args: ["27-46-13-33"] }] }))
  expect(result.ok, result.error?.message).toBe(true)
  await act(async () => {})
  expect(screen.getByText("esk_demo_key")).toBeTruthy()
  expect(snapshotText()).toContain("Copy")
  result = await act(() => agent.act({ steps: [{ ref: "Vault", action: "enter", args: ["11-22-33-44"] }] }))
  expect(parseActionRefusal(result.error)).toMatchObject({ action: "enter", kind: "unavailable" })
  expect(screen.getByText("esk_demo_key")).toBeTruthy()
  result = await act(() => agent.act({ steps: [{ ref: "Lock", action: "press" }] }))
  expect(result.ok, result.error?.message).toBe(true)
  await act(async () => {})
  expect(screen.queryByText("esk_demo_key")).toBeNull()
})

test("it has no axe violations, locked or open", async () => {
  const { container } = render(<App />)
  expect(await axeViolations(container)).toEqual([])
  await enter(combination)
  expect(await axeViolations(container)).toEqual([])
})

test("labels are overridable", async () => {
  render(
    <SafeVault
      label="Tresor"
      status="unlocked"
      onStatusChange={() => {}}
      labels={{ contents: "Inhalt", lock: "Abschließen", unlocked: "Offen", code: "Kombination", dial: "Rad" }}
    >
      x
    </SafeVault>,
  )
  await act(async () => {})
  expect(screen.getByRole("region", { name: "Inhalt" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Abschließen" })).toBeTruthy()
  expect(screen.getByRole("slider", { name: "Rad" })).toBeTruthy()
  expect(screen.getByRole("status").textContent).toBe("Offen")
})

test("the timeline rests locked and unlocked, plays out, and turns back from where it is", () => {
  const unlocking = { kind: "unlocking" as const, since: 1000 }
  expect(poseAt(unlocking, 1000)).toEqual(lockedPose)
  expect(poseAt(unlocking, 1000 + unlockMs)).toEqual(unlockedPose)
  expect(Math.max(...[1300, 1600, 1900, 2100].map((at) => poseAt(unlocking, 1000 + at).doorDegrees))).toBeGreaterThan(
    openDegrees,
  )
  expect(motionDone(unlocking, 1000 + unlockMs - 1)).toBe(false)
  expect(motionDone(unlocking, 1000 + unlockMs)).toBe(true)
  const locking = { kind: "locking" as const, since: 0 }
  expect(poseAt(locking, lockMs)).toEqual(lockedPose)
  const halfOpen = poseAt(unlocking, 1000 + 1200)
  const back = motionTowards("locking", halfOpen, 5000)
  expect(Math.abs(poseAt(back, 5000).doorDegrees - halfOpen.doorDegrees)).toBeLessThan(20)
})

test("the page's projection matches three.js's camera", () => {
  const aspect = 1100 / 750
  for (const pose of [lockedPose, poseAt({ kind: "unlocking", since: 0 }, 1500), unlockedPose]) {
    const framing = framingFor(pose, aspect, 1100)
    const camera = new PerspectiveCamera(cameraFovDegrees, aspect, 5, 2000)
    const position = cameraPosition(framing)
    camera.position.set(position.x, position.y, position.z)
    camera.lookAt(framing.target.x, framing.target.y, framing.target.z)
    camera.updateMatrixWorld()
    const project = projection(framing, aspect)
    for (const corner of plaqueCorners(18)) {
      const three = new Vector3(corner.x, corner.y, corner.z).project(camera)
      const ours = project(corner)
      expect(ours.x).toBeCloseTo((three.x + 1) / 2, 6)
      expect(ours.y).toBeCloseTo((1 - three.y) / 2, 6)
    }
  }
})

test("the plaque's matrix3d maps its box's corners onto the projected corners", () => {
  const stage = { width: 1100, height: 750 }
  const aspect = stage.width / stage.height
  for (const pose of [poseAt({ kind: "unlocking", since: 0 }, 2300), unlockedPose]) {
    const project = projection(framingFor(pose, aspect, stage.width), aspect)
    const corners = plaqueCorners(20).map((corner) => {
      const projected = project(corner)
      return { x: projected.x * stage.width, y: projected.y * stage.height }
    })
    const matrix = planeMatrix(corners, 341, 189)
    expect(matrix).not.toBeNull()
    if (!matrix) return
    const box = [
      applyMatrix(matrix, 0, 0),
      applyMatrix(matrix, 341, 0),
      applyMatrix(matrix, 341, 189),
      applyMatrix(matrix, 0, 189),
    ]
    box.forEach((point, index) => {
      expect(point.x).toBeCloseTo(corners[index]?.x ?? Number.NaN, 6)
      expect(point.y).toBeCloseTo(corners[index]?.y ?? Number.NaN, 6)
    })
    const mid = applyMatrix(matrix, 341 / 2, 189 / 2)
    const center = project({ x: 0, y: (plaqueCorners(20)[0]?.y ?? 0) - 10, z: plaqueCorners(20)[0]?.z ?? 0 })
    expect(mid.x).toBeCloseTo(center.x * stage.width, 4)
    expect(mid.y).toBeCloseTo(center.y * stage.height, 4)
  }
  expect(
    planeMatrix(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      10,
      10,
    ),
  ).toBeNull()
})

test("the closed door hides the opening, the open door shows all of it, and the settled plaque is readable", () => {
  const stage = { width: 1100, height: 750 }
  const aspect = stage.width / stage.height
  const closed = projection(framingFor(lockedPose, aspect, stage.width), aspect)
  expect(polygonArea(visibleOpening(closed, 0, stage))).toBeLessThan(stage.width * stage.height * 0.01)
  const open = projection(framingFor(unlockedPose, aspect, stage.width), aspect)
  const opening = visibleOpening(open, openDegrees, stage)
  const plaque = plaqueCorners(20)
    .map(open)
    .map((point) => ({ x: point.x * stage.width, y: point.y * stage.height }))
  expect(polygonArea(opening)).toBeGreaterThan(polygonArea(plaque))
  expect((plaque[1]?.x ?? 0) - (plaque[0]?.x ?? 0)).toBeGreaterThanOrEqual(330)
  const narrow = { width: 358, height: 448 }
  const phone = projection(settledFraming(narrow.width / narrow.height, narrow.width), narrow.width / narrow.height)
  const [left, right] = plaqueCorners(20).map(phone)
  expect(((right?.x ?? 0) - (left?.x ?? 0)) * narrow.width).toBeGreaterThan(narrow.width * 0.8)
})

test("the plaque grows with its contents within the panel", () => {
  expect(plaqueHeightFor(10, 10)).toBe(plaqueMinHeight)
  expect(plaqueHeightFor(180, 10)).toBe(18)
  expect(plaqueHeightFor(900, 10)).toBe(plaqueMaxHeight)
})

test("the scene's textures, environment and shadow map stay under 12 MB", () => {
  const mipmapped = 4 / 3
  const textures = Object.values(safeTextureSizes).reduce(
    (sum, { width, height, count }) => sum + width * height * 4 * mipmapped * count,
    0,
  )
  const halfFloatRgba = 8
  const environment = 3 * Math.max(environmentCubeSize, 16 * 7) * 4 * environmentCubeSize * halfFloatRgba
  const shadow = shadowMapSize * shadowMapSize * 4
  expect((textures + environment + shadow) / 1024 / 1024).toBeLessThan(12)
})

test("the plaque's finish follows the theme: the system dark fallback repeats .dark", () => {
  const css = readFileSync("registry/styles/safe-vault.css", "utf8")
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`)
    return css
      .slice(start, css.indexOf("}", start))
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
  }
  const dark = block(".dark")
  expect(dark.length).toBeGreaterThan(0)
  expect(block(':root:where(:not(.light, [data-color-scheme="light"]))')).toEqual(dark)
  expect(block(":root").map((line) => line.split(":")[0])).toEqual(dark.map((line) => line.split(":")[0]))
})
