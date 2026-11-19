# 08 · A second DialogTrigger drops the dialog's agent label

Written in English so it can go to UI SDK as is. Not reported yet. Found on `@ui-sdk/react` 0.1.0-beta.5 (2026-11-16); still there in 0.1.0-beta.10 (2026-11-18) and 0.1.0-beta.12 (2026-11-19).

## What happens

A closed `Dialog` with one `DialogTrigger` shows up in `agent.snapshot()` as `{ component: "dialog", label: "<trigger's name>" }`. Attach a second trigger outside the root through the controller, as the docs suggest for "triggers outside it", and the entry loses its `label`. It keeps `buttons: [<first trigger's name>, <second trigger's name>]`.

So an agent can no longer open it by name (`{ ref: "Search the workspace", action: "open" }`). It has to read the `ref` from a snapshot and `press` with a trigger's name as the argument. A screen reader is unaffected: each trigger keeps its own name, and the open dialog is named by its `DialogTitle`.

## Minimal repro

```tsx
import { createAgent } from "@ui-sdk/react/agent"
import { Dialog, DialogContent, DialogTitle, DialogTrigger, createDialogController } from "@ui-sdk/react/dialog"
import { render } from "@testing-library/react"

const agent = createAgent()
const controller = createDialogController()

render(
  <main>
    <Dialog controller={controller}>
      <DialogTrigger>Search the workspace</DialogTrigger>
      <DialogContent>
        <DialogTitle>Search the workspace</DialogTitle>
      </DialogContent>
    </Dialog>
    <DialogTrigger controller={controller} aria-label="Search" />
  </main>,
)

agent.snapshot().find((entry) => entry.component === "dialog")
// Expected: { component: "dialog", label: "Search the workspace", … }
// Actual:   { component: "dialog", buttons: ["Search the workspace", "Search"], … } with no label
```

Remove the second `DialogTrigger` and the label comes back.

## What we tried

| Attempt                                                  | Label with two triggers                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `aria-label` on `DialogContent`                          | No. The content isn't rendered while closed.                         |
| `keepMounted` on `DialogContent`, with its `DialogTitle` | Yes, from the title. But the closed content stays visible to agents. |
| A plain `Button` calling `controller.open()`             | Yes. The only trigger the bridge sees is the main one.               |

`Dialog` has no prop for its accessible name, so the name has to come from a trigger or a rendered title. `keepMounted` keeps the title in the page, but everything else inside the content stays mounted too. In a ⌘K palette the closed `Command` stays in the snapshot as an operable component, and its name matches the dialog's.

## What Eskais UI does

`CommandDialogOpenButton` (in `registry/ui/command-dialog.tsx`) is a `Button` with `aria-haspopup="dialog"` and `data-agent-hidden` that calls `controller.open()`. People get the same dialog, and focus returns to the button on close. Agents see one trigger and open the dialog by its name. `test/command-dialog-search.test.tsx` covers both.

## What we'd ask UI SDK

Either keep the first trigger's name (or the title's text) as the dialog's agent label when more triggers join, or accept an explicit label on the root, such as `<Dialog label="Search the workspace">`. With either, `CommandDialogOpenButton` can go back to being a `CommandDialogTrigger`.
