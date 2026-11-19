# 09 · A popover open from the start closes when its dialog takes initial focus

Written in English so it can go to UI SDK as is. Not reported yet. Found on `@ui-sdk/react` 0.1.0-beta.10 (2026-11-19).

## What happens

A non-modal `Popover` with `defaultOpen` (or `open` true from its first render) inside a `Dialog` closes right after the dialog opens, with `details.reason === "focus-out"`. The dialog moves focus to its initial focus target, that focus lands outside the popover's layer, and the popover treats it as focus leaving the popover, though focus was never inside it.

It closes whenever the dialog's initial focus lands outside the popover and its trigger: `initialFocus="content"` (the dialog itself, which a long reading dialog uses so reading starts at the top), a selector, or the first focusable element when that comes before the trigger. With `initialFocus` left at `"auto"` and the trigger as the first focusable element, focus lands on the trigger and the popover stays open.

The same happens outside a dialog: a popover open from the start closes on the first `focus()` call anywhere else on the page. The docs say "A popover open from the start leaves focus alone" and "Focus leaving the popover closes it"; here focus never entered.

## Minimal repro

```tsx
import { Dialog, DialogContent, DialogTitle } from "@ui-sdk/react/dialog"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover"
import { render } from "@testing-library/react"

render(
  <Dialog defaultOpen>
    <DialogContent initialFocus="content">
      <DialogTitle>Task</DialogTitle>
      <Popover defaultOpen onOpenChange={(open, details) => console.log(open, details.reason)}>
        <PopoverTrigger>Acceptance 2/3</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Acceptance criteria</PopoverTitle>
        </PopoverContent>
      </Popover>
    </DialogContent>
  </Dialog>,
)
// Logs: false "focus-out". The popover is gone once the dialog has focused itself.
```

`details.event.target` is the dialog's content element, an ancestor of the popover's trigger.

## What we tried

| Attempt                                                                                         | Result                                                                                                        |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `initialFocus="none"` on the `PopoverContent`                                                   | No. The popover moves no focus either way; the dialog's move closes it.                                       |
| `initialFocus` on the dialog pointing into the popover                                          | Works, but the dialog then opens with focus in a side detail, not at the top, and it needs the popover's DOM. |
| Cancelling every `focus-out` in `onOpenChange`                                                  | Works, but Tab out of the popover and focus moving elsewhere stop closing it.                                 |
| Cancelling a `focus-out` onto an ancestor of the trigger, until focus first reaches the popover | Works: only the dialog's own initial focus is ignored, and every later focus move closes it as usual.         |

## What Eskais UI does

`Popover` in `registry/ui/popover.tsx` wraps the root. While a popover that was open from its first render hasn't had focus yet (no `focus` event inside its content), a `focus-out` whose target is an ancestor of its trigger is cancelled with `details.cancel()`. Any other change, or the first focus inside, ends that window. `test/popover.test.tsx` and `node tooling/popover-check.mjs` (Chrome) cover a dialog open from the start, a dialog opened later, and focus leaving afterwards.

## What we'd ask UI SDK

Close a non-modal popover on `focus-out` only when focus leaves it: when the focus moving away was inside its layer, or on its trigger. A popover open from the start, with focus elsewhere, would then close on an outside press, Escape, or the trigger, and stay open while its dialog mounts. The workaround can then go.
