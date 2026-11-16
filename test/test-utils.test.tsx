import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test } from "vitest"

import { Alert, AlertTitle } from "@/components/ui/alert"
import { ToastStack, createToaster } from "@/components/ui/toast"
import {
  getToast,
  ignoreAnnouncer,
  isAnnouncer,
  queryAlerts,
  queryStatuses,
  queryToast,
  queryToasts,
  readAnnouncements,
  resetAnnouncer,
} from "@/lib/test-utils"

import { settle } from "./overlay-helpers"

function renderStack() {
  const toaster = createToaster()
  render(<ToastStack toaster={toaster} />)
  return toaster
}

test("a closed toast's text stays in the live region, which the helpers skip", async () => {
  const user = userEvent.setup()
  const toaster = renderStack()
  await act(async () => {
    toaster.success("Task archived", { description: "Index the docs" })
  })
  await settle(300)

  expect(screen.getAllByText(/Task archived/)).toHaveLength(2)
  expect(screen.getByText("Task archived", { ignore: ignoreAnnouncer })).toBeTruthy()
  const toast = getToast("Task archived")
  expect(toast.dataset.type).toBe("success")
  expect(queryToasts()).toEqual([toast])
  expect(readAnnouncements().polite).toContain("Task archived")

  await user.click(within(toast).getByRole("button", { name: "Dismiss" }))
  await settle()
  expect(queryToast("Task archived")).toBeNull()
  expect(queryToasts()).toEqual([])
  const leftover = screen.getByText(/Task archived/)
  expect(isAnnouncer(leftover)).toBe(true)
  expect(isAnnouncer(leftover.firstChild)).toBe(true)
  expect(screen.queryByText("Task archived", { ignore: ignoreAnnouncer })).toBeNull()
})

test("queryAlerts and queryStatuses leave out the live regions", async () => {
  const toaster = renderStack()
  await act(async () => {
    toaster.error("Deploy failed")
  })
  await settle(300)
  expect(screen.getAllByRole("alert").some(isAnnouncer)).toBe(true)
  expect(queryAlerts()).toEqual([])
  expect(queryStatuses()).toEqual([])
  expect(readAnnouncements().assertive).toContain("Deploy failed")

  render(
    <Alert tone="destructive" live>
      <AlertTitle>Quota reached</AlertTitle>
    </Alert>,
  )
  expect(queryAlerts().map((node) => node.textContent)).toEqual(["Quota reached"])
})

test("getToast throws when no toast or several match, and queryToast when several do", async () => {
  const toaster = renderStack()
  expect(() => getToast("Saved")).toThrow(/no toast with Saved/)
  await act(async () => {
    toaster("Saved")
    toaster("Saved")
  })
  expect(() => queryToast("Saved")).toThrow(/2 toasts/)
  expect(queryToasts()).toHaveLength(2)
})

test("resetAnnouncer removes the live regions and UI SDK makes new ones", async () => {
  const toaster = renderStack()
  await act(async () => {
    toaster("First")
  })
  await settle(300)
  expect(document.querySelectorAll("[data-ui-sdk-announcer]").length).toBeGreaterThan(0)

  resetAnnouncer()
  expect(document.querySelectorAll("[data-ui-sdk-announcer]")).toHaveLength(0)
  expect(readAnnouncements()).toEqual({ polite: "", assertive: "" })

  await act(async () => {
    toaster("Second")
  })
  await settle(300)
  expect(readAnnouncements().polite).toContain("Second")
  expect(screen.queryByText(/First/, { ignore: "script, style" })?.closest("[data-slot=toast]")).toBeTruthy()
})
