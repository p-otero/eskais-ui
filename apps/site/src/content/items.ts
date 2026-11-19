type ItemNotes = {
  /** One line on when to reach for it, shown under Usage. */
  usage?: string
  a11y?: string[]
  /** What an agent sees and can do, beyond the live snapshot. */
  agent?: string
  related?: string[]
}

const itemNotes: Record<string, ItemNotes> = {
  appearance: {
    usage: "Create one appearance per app, call apply() before the first render, and wrap the app in <Appearance>.",
    a11y: [
      "Follows prefers-color-scheme until the person chooses, and keeps that choice in storage you pass.",
      "Writes data-color-scheme so a server-rendered page can honour an explicit light choice with no flash.",
    ],
    related: ["tone", "segmented-control", "switch"],
  },
  tone: {
    usage: "Import Tone wherever a component takes a status, instead of loose strings or component-specific words.",
    a11y: ["Every tone's soft foreground reaches 4.5:1 on its soft fill, in both modes and every palette."],
    related: ["badge", "alert", "status-pill", "progress"],
  },
  button: {
    a11y: [
      "A real <button> from UI SDK: Enter and Space, focus ring, disabled that can stay focusable.",
      "While pending it sets aria-busy, ignores presses and keeps focus; pendingAnnouncement is read after a second.",
      'size="icon" requires aria-label at the type level, and shows it in a tooltip that labels the button, so the name is heard once.',
    ],
    agent:
      "Agents press it by its text, or an icon button by its aria-label; its tooltip stays out of the snapshot. With data-agent-confirm, the press waits for your allow callback.",
    related: ["spinner", "confirm-dialog", "toggle"],
  },
  kbd: {
    a11y: ["Renders <kbd>, so screen readers announce keys as keyboard input."],
    related: ["command", "tooltip", "dropdown-menu"],
  },
  shortcuts: {
    a11y: [
      "Plain keys never fire while someone types in a field or contenteditable, nor during IME composition.",
      "Hints are aria-hidden Kbd; the control carries aria-keyshortcuts instead.",
    ],
    agent: "Nothing new: shortcuts press the same parts agents already press by name.",
    related: ["shortcuts-dialog", "kbd", "button", "list-item"],
  },
  "shortcuts-dialog": {
    a11y: [
      "A modal dialog titled by its heading; each scope is a labelled section of key and description pairs.",
      "? opens it on any keyboard layout: a symbol shortcut matches the character typed, whether it took Shift, AltGr or Option.",
      "ShortcutsDialogTrigger is the way in on touch screens, where there is no ? key; it takes focus as it opens, so its scope's shortcuts are listed in Safari too.",
    ],
    agent:
      "Agents open it by pressing the ShortcutsDialogTrigger by name; the shortcuts themselves add nothing for agents, who press the same buttons.",
    related: ["shortcuts", "dialog", "kbd"],
  },
  separator: {
    a11y: ['Announced as a separator, or decorative with role="none" when it only draws a line.'],
    related: ["card", "dropdown-menu"],
  },
  label: {
    a11y: ["Names any control by htmlFor, including radio groups, sliders and switches.", "Grows to 44px on touch."],
    related: ["field", "checkbox", "radio-group"],
  },
  form: {
    usage: "Use Form for anything with validation; FormField binds Input, Select, Checkbox and friends by name.",
    a11y: [
      "Each FormField wires label, description and error to its control with aria-describedby and aria-invalid.",
      "On a failed submit, focus moves to the first invalid field, or to the root error.",
      "Fields are disabled while submitting (configurable), and a second submit is ignored.",
    ],
    agent: "With a label, the form exposes submit and reset. Agents fill each field through its own part.",
    related: ["form-dialog", "field", "input", "select"],
  },
  "form-dialog": {
    a11y: [
      "Escape, outside presses and Cancel do nothing while submitting; focus returns to the trigger on success.",
      "confirmDiscard asks before closing with unsaved changes.",
      "On narrow screens it becomes a bottom sheet with a sticky footer.",
    ],
    related: ["form", "dialog", "confirm-dialog"],
  },
  "step-dialog": {
    usage: "Use StepDialog (or StepForm inline) when one schema is too long for one screen.",
    a11y: [
      'The progress is an ordered list; the current step has aria-current="step".',
      "Next and Back move focus to the step's heading; a failed submit returns to the step with the first error and focuses it.",
      "Enter on any step goes to the next one, and on the last step submits.",
    ],
    agent: "Agents fill each step's fields by label and press Next, Back and the submit button by name.",
    related: ["form", "form-dialog", "steps"],
  },
  field: {
    a11y: [
      "FieldLabel, FieldDescription and FieldError are linked to the control automatically.",
      "FieldError matches native validity states (valueMissing, typeMismatch…), shown after the field is touched.",
    ],
    related: ["input", "form", "label"],
  },
  input: {
    a11y: ["InputClear clears the value and returns focus to the input.", "Named by the surrounding Field's label."],
    agent: "Agents set its value with setValue; a containing Field validates on the agent's blur.",
    related: ["field", "search-field", "textarea"],
  },
  textarea: {
    a11y: ["autoResize grows with the text; a submit shortcut can be added for chat-like inputs."],
    related: ["input", "field", "markdown-editor"],
  },
  "token-input": {
    usage:
      "Reach for it when a field holds a list, like labels or topics; without tokenType it mixes text with mentions or files.",
    a11y: [
      "One multiline text box named by its Field; each token reads as its label and kind, and adding or removing one is announced.",
      "Backspace and Delete remove the token beside the caret, arrows cross a token in one press, and Ctrl+Z or Cmd+Z undoes.",
      "The remove buttons are for pointers only, grow to 44px on touch and are named for hover by labels.remove.",
    ],
    agent: "Agents find it by its label and call setValue with comma-separated labels, insert, removeToken or clear.",
    related: ["input", "field", "badge", "form"],
  },
  "number-input": {
    a11y: [
      "Arrow keys, Page Up/Down and Home/End step the value; the step buttons need their own aria-label.",
      "Values are formatted and parsed with Intl in the page's locale.",
    ],
    related: ["slider", "input", "field"],
  },
  tree: {
    usage:
      "Reach for it for nested items people expand and collapse: a file explorer, nested settings, a table of contents. For a flat list use List.",
    a11y: [
      "The WAI-ARIA tree: one tab stop, arrows move and expand, Home/End, typeahead, * expands siblings.",
      "Every row says its level and place among its siblings; checkable trees report mixed branches.",
      "Icons are decorative; the label names each item.",
    ],
    agent: "Agents find the tree by its aria-label and expand, collapse, select or check items by value.",
    related: ["list-item", "sidebar", "document-workspace"],
  },
  "file-input": {
    usage: "Reach for it to attach or upload files; FileUpload is the drop zone, the list and the errors in one.",
    a11y: [
      "The browse button is the field's control, so the Field's label names it and Enter or Space opens the picker; dropping is never the only way.",
      "The file list has one tab stop: arrows move between files and Delete removes one; remove buttons are named for their file.",
      "Added, removed and rejected files are announced in a polite live region; the reasons also show in the destructive tone.",
    ],
    agent: "Agents find it by its label and can clear it or remove a file; picking files stays with a person.",
    related: ["attachments", "field", "form"],
  },
  autocomplete: {
    usage:
      "Reach for it when any text is valid and suggestions only help: a search box, a city, a tag name. When the value must be an option, use Combobox.",
    a11y: [
      "An input with the combobox role; arrows highlight a suggestion while focus stays in the input, Enter fills it in, Escape closes.",
      "The matched part of each suggestion is marked in a heavier weight, not only a colour.",
      "Clear and Show suggestions are icon buttons named for agents and screen readers, with the name in a tooltip.",
    ],
    agent: "Agents find it by its label and set any text with setValue.",
    related: ["combobox", "search-field", "field", "form"],
  },
  "password-input": {
    a11y: [
      "A native password field named by its Field label, so password managers and autofill work.",
      'The toggle is a toggle button named "Show password" whose aria-pressed says whether the password shows; its name never flips.',
      "A pointer press on the toggle keeps the caret in the field; submitting or leaving the page hides the password again.",
    ],
    agent: "Agents find it by its label, set the value and show or hide it with toggleVisible.",
    related: ["input", "field", "form"],
  },
  rating: {
    a11y: [
      'A radio group: arrow keys change the score, Space checks the focused star; each score is a radio named like "3 stars".',
      "Stars fill in the warning colour over an input-strong outline, so the score shows by shape and fill, not hue alone.",
      "Read-only, it is one image named by getValueLabel.",
    ],
    agent: "Agents find it by its label and set a score with setValue.",
    related: ["radio-group", "slider", "field"],
  },
  "date-input": {
    usage: "Reach for it for a date people know and type, like a birthday or a start date; DatePicker adds a calendar.",
    a11y: [
      "A group named by its Field label; each segment is a spin button named by its unit in the page's language.",
      "Typing fills a segment and moves on, arrows step it, and a pasted date fills them all.",
    ],
    agent: "Agents find it by its label and set an ISO date with setValue.",
    related: ["date-picker", "date-time-picker", "field"],
  },
  "color-picker": {
    a11y: [
      "The area's thumb is a slider screen readers hear as both channels; each slider names its channel; arrow keys step them.",
      "The text field takes any CSS colour on Enter or blur, and goes back to the value when the text isn't one.",
      "Presets are one tab stop with arrow keys between them; the eye dropper is an icon button with a tooltip, hidden where unsupported.",
    ],
    agent: "Agents find it by its label and set any CSS colour with setValue.",
    usage:
      "In OKLCH the area paints its whole box: inside the gamut each point is its own colour, and past the edge it shows the colour the picker holds there, so the thumb always sits on the colour chosen.",
    related: ["slider", "input", "popover"],
  },
  "image-cropper": {
    usage:
      'Reach for it to crop an upload before saving: a cover image with a box, an avatar with mode="frame" and shape="circle".',
    a11y: [
      "The selection is a slider: arrow keys move it, and R rotates, Shift+R back.",
      "Zoom is a range input; rotate and flip are buttons with visible labels.",
      "Until the image loads, the group is aria-busy and nothing can change.",
    ],
    agent: "Agents find it by its label and set the crop or the zoom.",
    related: ["file-input", "avatar", "lightbox"],
  },
  "confirm-button": {
    usage:
      "Reach for it for a quick, reversible-by-undo destructive action in a row or toolbar; ConfirmDialog when the consequence needs explaining.",
    a11y: [
      "A native button: once armed, its text and name become the armed label, which is also announced politely.",
      "Escape (only while armed), a timeout and focus leaving disarm it; holding is never the only way, since a second press confirms.",
      "While onConfirm's Promise runs, it is aria-busy and ignores presses.",
    ],
    agent: "Agents call confirm, which carries data-agent-confirm, so it waits for a person's approval through allow.",
    related: ["confirm-dialog", "button"],
  },
  "inline-edit": {
    usage:
      "Reach for it to rename a title, a list item or a tab without a dialog; a Form or FormDialog for anything with more than one field.",
    a11y: [
      "The text is a button described by the hint; the field is named by label; Enter and Escape return focus to the text.",
      "Escape inside the field never closes a dialog around it; validate keeps the field open on an invalid name.",
      "The edit button is an icon button with its name in a tooltip, always visible on touch screens.",
    ],
    agent: "Agents find it by its label and call rename with the new text, or cancel an edit in progress.",
    related: ["input", "list-item", "tabs"],
  },
  "otp-input": {
    a11y: [
      "One native input shown as slots, so paste, autofill and one-time-code all work.",
      "Treated as secret: agents can fill it but never read it back.",
    ],
    related: ["input", "field"],
  },
  "search-field": {
    a11y: [
      "A search landmark: Enter runs onSearch, Escape clears.",
      "Built with definePrimitive, since UI SDK has no search part.",
    ],
    agent: "Exposes a submit action to agents, only when onSearch is set.",
    related: ["input", "filter-bar", "command"],
  },
  select: {
    a11y: [
      "A listbox popup with typeahead, arrow keys and Home/End; the trigger shows the selected label.",
      "Outside a Field, name it with aria-label.",
    ],
    agent: "Agents choose by value or by label; options are known before the list opens.",
    related: ["native-select", "combobox", "field"],
  },
  "native-select": {
    a11y: [
      "The platform's own picker, best on touch screens and for long lists.",
      "Native required and form submit work.",
    ],
    agent: "Rendered through its own primitive so agents can list and set its choices; a bare <select> is invisible.",
    related: ["select", "combobox"],
  },
  combobox: {
    a11y: [
      "A filtering input with listbox semantics: the highlight moves with arrow keys while focus stays in the input.",
      "Clear and trigger buttons need their own names.",
    ],
    related: ["select", "command"],
  },
  checkbox: {
    a11y: [
      "Checked, unchecked and indeterminate, with a 3:1 edge from input-strong.",
      "Grows to a 44px hit area on touch.",
    ],
    agent: "Agents call setChecked(true | false); other values are refused.",
    related: ["switch", "radio-group", "field"],
  },
  "radio-group": {
    a11y: ["One tab stop; arrow keys move and select.", "Named by its Field label or aria-label."],
    related: ["segmented-control", "checkbox", "select"],
  },
  switch: {
    a11y: ["An on/off setting with role switch; put it in a row beside its label.", "Grows to 44px on touch."],
    related: ["checkbox", "toggle"],
  },
  slider: {
    a11y: [
      "Arrow keys, Page Up/Down and Home/End; each thumb in a range needs its own label.",
      "SliderValue is formatted.",
    ],
    agent: 'Agents set numbers, or text that starts with one, like "30".',
    related: ["number-input", "meter"],
  },
  toggle: {
    a11y: ["A button that stays pressed, with aria-pressed. Pressed is a full primary fill for 3:1."],
    related: ["toggle-group", "switch", "button"],
  },
  "toggle-group": {
    a11y: ["One tab stop with arrow-key focus; single or multiple values."],
    related: ["toggle", "segmented-control", "stage-track"],
  },
  "segmented-control": {
    a11y: [
      "One choice from a row, as a radio group: arrow keys move and select.",
      "The indicator slides, or fades under reduced motion.",
      "activateOnPress (off by default) checks an item on a mouse or pen press instead of on release, like macOS. Touch stays on release, so scrolling past doesn't change it. WCAG 2.5.2 allows it because another press undoes it; actions and menus always activate on release.",
    ],
    related: ["tabs", "radio-group", "toggle-group"],
  },
  calendar: {
    a11y: [
      "A grid with arrow keys, Page Up/Down for months and Home/End for weeks.",
      "Week start and names follow the locale.",
    ],
    related: ["date-picker", "date-time-picker"],
  },
  "date-picker": {
    a11y: [
      "Type a date in the locale's format or pick it from a calendar popup.",
      "Values are ISO dates, like 2026-11-20.",
    ],
    related: ["calendar", "date-time-picker"],
  },
  "date-time-picker": {
    a11y: [
      "The date and the time each have their own label, so they never share an id or a name.",
      "timeZone shows the zone's short name and describes the time input.",
    ],
    related: ["date-picker", "calendar", "form"],
  },
  dialog: {
    a11y: [
      "Focus moves in and is trapped; Escape closes; focus returns to the trigger.",
      "Named by DialogTitle and described by DialogDescription.",
      "Opaque reading surface in every theme, and a bottom sheet on narrow screens.",
    ],
    related: ["confirm-dialog", "drawer", "form-dialog"],
  },
  "confirm-dialog": {
    a11y: [
      "An alert dialog: async confirm with pending state, no double submit and an inline error on failure.",
      "Closes on success and returns focus to the trigger.",
    ],
    agent:
      'tone="destructive" requires agentConfirm, which becomes data-agent-confirm: agents need a person to approve.',
    related: ["dialog", "button", "proposal-actions"],
  },
  drawer: {
    a11y: ["A modal sheet from any edge, with the dialog's focus rules; drag to dismiss on touch."],
    related: ["dialog", "sidebar"],
  },
  popover: {
    a11y: [
      "Focus moves in, Escape and outside presses close it, focus returns to the trigger.",
      "Named by PopoverTitle.",
      "Open from the start inside a dialog, it stays open while the dialog takes its initial focus.",
    ],
    related: ["hover-card", "tooltip", "dropdown-menu"],
  },
  tooltip: {
    a11y: [
      "Names or describes its trigger; opens on hover and focus, never holds interactive content.",
      "Escape dismisses it without moving focus.",
      "A touch screen never opens it, so it never covers the finger or hides what a tap does.",
    ],
    related: ["popover", "kbd", "button"],
  },
  "hover-card": {
    a11y: ["A link that previews where it goes: the link still works without the card."],
    related: ["popover", "tooltip"],
  },
  "dropdown-menu": {
    a11y: ["Arrow keys, typeahead and Escape; checkbox and radio items announce their state."],
    agent: "Agents press items by their text; destructive items carry data-agent-confirm.",
    related: ["context-menu", "menubar", "command"],
  },
  "context-menu": {
    a11y: ["Opens on right-click, long press or Shift+F10 on a focusable trigger."],
    related: ["dropdown-menu", "menubar"],
  },
  command: {
    usage:
      "Run actions through Command onAction. A command with href is a link instead: Enter, a click, its shortcut or a mouse press follow it (fast links: a #/… hash route or a same-origin path on press), and it never runs onAction. Pass onFollow to route on the client and close the palette.",
    a11y: [
      "Typing filters; arrow keys move the highlight; Enter runs, or follows a link command.",
      "A link command stays an option of the listbox, rendered as an anchor, so modified clicks open a new tab.",
      "The ⌘K shortcut is opt-in on the trigger.",
      'In a CommandDialog, each open starts with an empty search, and one Escape closes it and returns focus to the trigger; escapeKey="clear" clears the search first.',
    ],
    agent: "Agents search and highlight commands by name (setQuery, setValue); UI SDK offers no action that runs one.",
    related: ["combobox", "dropdown-menu", "kbd"],
  },
  lightbox: {
    a11y: [
      "Arrow keys move between images with a counter; focus returns to what opened it.",
      "Sized in % of the top layer, never viewport units.",
    ],
    agent: "Agents see Image viewer with next, previous and goTo(index).",
    related: ["attachments", "dialog"],
  },
  sidebar: {
    a11y: [
      "A named navigation landmark; the current item has aria-current=page.",
      "Collapses to an icon rail with tooltips, and to a drawer on narrow screens.",
    ],
    related: ["skip-link", "page-layout", "navigation-menu"],
  },
  "navigation-menu": {
    a11y: ["A named landmark of triggers that disclose panels of links; Escape closes and returns focus."],
    related: ["menubar", "sidebar", "breadcrumb"],
  },
  menubar: {
    a11y: ["One tab stop, arrow keys between menus, menus open with Enter or arrow down."],
    related: ["dropdown-menu", "navigation-menu"],
  },
  inbox: {
    usage:
      "Copy it, then edit the copy object at its top and the row and panel content. A keyboard-first list with an inspector: sampleInboxItems(count) makes demo data.",
    a11y: [
      "Rows are one tab stop: j/k or the arrows move, Enter opens the side panel, Escape closes it and focus returns to the row.",
      "The panel is a complementary region named by the message subject; U and P are shown on its buttons and set aria-keyshortcuts.",
      "1,500 messages render only the rows in view, with aria-setsize and aria-posinset; find in page still reaches the rest.",
    ],
    agent:
      "Agents select any message with the list's select(id), rendered or not, and press the panel's buttons by name.",
    related: ["list-item", "side-panel", "shortcuts-dialog"],
  },
  conversation: {
    usage:
      "A chat or agent thread: messages in a log that follows the newest one, a pill when new ones arrive while the reader is scrolled up, and a composer.",
    a11y: [
      "The thread is a named role=log, so screen readers announce new messages; it takes focus to scroll from the keyboard.",
      "Each message is an article named by its author and time; one without an author is named by its role for screen readers.",
      "A streaming message is aria-busy, so it is read once it is whole rather than a word at a time.",
      "The new-below pill moves focus to the log when pressed, and the jump is instant under reduced motion.",
    ],
    agent:
      "Agents read the messages as the thread's items (author: text), call jumpToLatest and loadOlder, and send by setting the Message field and pressing Send.",
    related: ["textarea", "avatar", "relative-time", "agent-task-board"],
  },
  "activity-log": {
    usage:
      "Show who changed what and when, and let people and agents step back: record the page's controls with createActivityLog, add your own changes with record, list them with ActivityLog.",
    a11y: [
      'The log is a named group; the current point in its history has aria-current="step", and undone entries say so to screen readers.',
      "Undo and Redo bind Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z, listed in ShortcutsDialog, and leave those keys to a focused text field.",
    ],
    agent:
      "Agents read the entries as items and call undo, redo and seek (by position or by an entry's sentence). A seek that undoes more than confirmAbove entries carries data-agent-confirm, so a person approves it.",
    related: ["toast", "shortcuts-dialog", "agent-task-board"],
  },
  "master-detail": {
    usage:
      "A list with a detail pane, for review queues, inspectors and device lists: pass the list and a detail(id) view, and let it handle selection, stacking and focus.",
    a11y: [
      "The list and the detail are named regions; the open row has aria-current.",
      "Opening moves focus to the detail's heading, and Close, Back or Escape return it to the row that opened it.",
      "Below 42rem of container the panes stack: the list, or the open item with a Back button. Nothing overlays.",
      'With idleDetail="visible" the idle detail stays under the list, with a Collapse/Expand button that keeps focus and says aria-expanded.',
    ],
    agent:
      "Agents open and close items through the block by its label (open(id), close()), with the items you pass listed as choices; Back, Close, Collapse and Expand are buttons they press by name.",
    related: ["list-item", "side-panel", "resizable"],
  },
  "dashboard-grid": {
    usage:
      "A home or metrics screen: a row of DashboardStats over DashboardCards that load through status and data, with charts and meters inside.",
    a11y: [
      "Each card is a region named by its title; a DashboardChart inside is named by the same title, and a DashboardMeter keeps role=meter with its label.",
      "Cards in a row share its height, at least --dashboard-row-height, so a card keeps its size from loading to loaded and grows its row rather than clip.",
      "A failed card announces its error once, as an alert, with a Retry button.",
    ],
    agent:
      "Agents press the cards' own buttons (Retry, your actions) by name; charts expose their data through ChartDataTable.",
    related: ["stat", "chart", "meter", "states", "card"],
  },
  "settings-page": {
    usage:
      "A settings or device page: SettingsSections of SettingsRows, SettingsFacts for read-only facts and a SettingsDangerZone, with a navigation that follows your scroll.",
    a11y: [
      "The navigation is a named landmark; the section being read has aria-current=location.",
      "Going to a section scrolls by id and moves focus to its heading, without touching location.hash, so hash routers keep their route.",
      'Section links take their href from the url adapter (#/settings?section=id through a hash router), so a new tab opens the route; navigation="buttons" scrolls without an address.',
      "Each section is a region named by its title and described by its description; each row's label names its control.",
      "SettingsDangerAction disabled and pending reach its trigger: disabled, or busy with a spinner while it keeps focus; the dialog doesn't open, for agents either.",
    ],
    agent:
      "Agents follow a section's link or set the section picker by name, set each row's control by its label, and need a person's approval to confirm a danger action.",
    related: ["field", "description-list", "confirm-dialog", "select"],
  },
  "document-workspace": {
    usage:
      "For any notes or docs app: put a MarkdownEditor (edit) or MarkdownView (read) in document, your file tree in explorer, DocumentOutline and backlinks in aside, and DocumentQuickOpen in quickOpen: items to filter in the browser, or a PageSource as source to search notes on the server, bodies included; an item's snippet shows the passage that matched under its title, with the query's words marked. Pass the editor's ref as editorRef, extractHeadings(markdown) as headings and the open note's id as documentId, so the narrow explorer drawer closes when any control opens a note. In a Shell, main fill (on the Shell or the route) lets it fill the height left.",
    a11y: [
      "The explorer is a navigation landmark, the document a named region (or main) and the aside a complementary landmark; the Files and Details toggles carry aria-expanded and aria-controls.",
      "It lays out by its own width: resizable, collapsible columns when wide, drawers when narrow. Drawers, quick open and menus give focus back to the document.",
      "The save state is a polite status; the alert slot is an assertive region that is always present, so a conflict is read once when it appears.",
      "Ctrl/Cmd+P opens quick open; the outline moves the caret to a heading in edit mode and focus to it in read mode, and switching modes keeps the heading you were reading at the top.",
    ],
    agent:
      "Agents switch the Mode segmented control, press Files, Details and Quick open by name, read a quick open item as its title, folder and snippet, run one, follow wikilinks and use the editor's own actions.",
    related: ["markdown-editor", "markdown-view", "resizable", "drawer", "command"],
  },
  "side-panel": {
    usage:
      "An inspector beside a list: open it from a row's onSelect, pass returnFocus to the row, and give its buttons a shortcut.",
    a11y: [
      "A non-modal complementary region named by its title, so the list beside it stays usable.",
      "Escape closes it; focus that was inside returns to the row that opened it.",
      'On narrow screens narrow="stack" (default) keeps it in the flow below the list, hiding nothing and trapping no focus; "sheet" is a modal bottom sheet that takes focus and gives it back.',
    ],
    related: ["list-item", "drawer", "shortcuts"],
  },
  "landing-page": {
    usage:
      "Copy it, then edit the content object at its top and the blocks' props. It is the template for a new landing page: no hand-written layout, only blocks.",
    a11y: [
      "One h1 in the hero; every section is a region named by its SectionHeading.",
      'Pass as="div" when the page already renders its <main>.',
    ],
    agent:
      "Agents read it through its parts: the install command's copy action, links with onFollow, and any controls you put in the tiles.",
    related: ["hero", "section-heading", "bento", "steps", "site-footer"],
  },
  hero: {
    usage:
      "The first section of a landing page: eyebrow, title and a muted second line, description, actions, an install command and an aside for a live demo.",
    a11y: [
      "A section named by its heading (h1 by default, headingLevel for another level).",
      "The decoration is aria-hidden and drawn with theme tokens, so it follows the palette and mode.",
    ],
    agent: "The install command is a CodeBlock with a copy action; actions are whatever controls you pass.",
    related: ["section-heading", "code-block", "landing-page"],
  },
  "section-heading": {
    usage:
      "Head each page section with it, and give the section aria-labelledby the headingId so it becomes a named region.",
    a11y: ["The heading level is yours to set, so the outline stays in order."],
    related: ["hero", "bento", "steps", "section"],
  },
  bento: {
    usage:
      "Bento lays out tiles by its container's width: one column, two from 48rem, columns from 64rem. BentoTile spans columns and holds any live demo.",
    a11y: [
      "Each tile is a Card section named by its title.",
      "With href the title is the link and its hit area covers the tile, while controls inside stay their own targets.",
    ],
    agent:
      "Tiles are content; their links take onFollow to be followable by agents, and controls inside are their own parts.",
    related: ["card", "landing-page", "hero"],
  },
  steps: {
    usage: "Numbered instructions: Step takes a title, a description and children, like a CodeBlock.",
    a11y: ["An ordered list, so the count comes from the list; the visual numbers are hidden from screen readers."],
    related: ["code-block", "landing-page"],
  },
  "site-footer": {
    usage:
      "The page footer: brand, description, link groups and a bottom line. Links accept every Link prop, onFollow included.",
    a11y: ["Each group is a navigation landmark named by its title; links are muted and underline on hover."],
    related: ["link", "separator", "landing-page"],
  },
  shell: {
    usage:
      "The frame of an application from one list of routes: pass routes, groups, currentHref and onNavigate (or plain or #/route hrefs), a brand and actions, and put each page in a PageLayout inside it; main fill (on the Shell or a route) is for an editor or workspace that fills the height left. Use DocsLayout instead for documentation with a table of contents.",
    a11y: [
      "A skip link first, to the <main> landmark, which takes focus (tabIndex -1) without changing the URL, so hash routers keep their route.",
      'The sidebar and the bottom bar are navigation landmarks named by labels.sidebar and labels.mobileNav; the current route carries aria-current="page" in both, and in the palette.',
      "On narrow screens the topbar's trigger opens the sidebar as a drawer; Escape closes it and focus returns to the trigger. The palette (Ctrl/⌘+K) returns focus the same way: it opens with an empty search, and one Escape closes it whatever the search holds.",
      "The bottom bar is sticky at the end of the shell rather than fixed, so the page always ends above it, also inside a pane or an iframe; scroll margins keep focused elements clear of the topbar and the bar.",
    ],
    agent:
      "Every route is a sidebar Link with a follow action that calls onNavigate (or loads the href), so agents follow routes by name. The palette's Go to commands (link commands to each route's href) are listed under the palette once its Search trigger is pressed; agents collapse and expand the sidebar by its name. sidebarShortcut presses that same trigger, so it adds nothing new for agents.",
    related: ["sidebar", "topbar", "command", "mobile-nav", "skip-link", "docs-layout"],
  },
  "docs-layout": {
    usage:
      "A documentation app shell: DocsLayout with a topbar (a Topbar with a SidebarTrigger), a sidebar that sticks under it, a breadcrumb header above the page, the content and a sticky toc; DocsToc from useTocItems, DocsPager and DocsBreadcrumb. useSidebarState({ storageKey }) wires the trigger and the Sidebar and remembers the collapsed state.",
    a11y: [
      "The sidebar sticks under the topbar at the full remaining height and scrolls on its own; on narrow screens it is the Sidebar's drawer, opened by the same SidebarTrigger.",
      "The SidebarTrigger is named for its next step (Collapse sidebar, Expand sidebar, Open navigation) and carries aria-expanded.",
      "Everything in the page gets a scroll margin for the topbar, so anchors, focus and scrollIntoView never land under it.",
      'DocsToc marks the heading being read with aria-current="location", from an IntersectionObserver.',
      'Pass as="div" when the page already has its <main>.',
    ],
    agent:
      "Sidebar items, crumbs and pager links are Links: pass onFollow where agents should follow them. Agents collapse and expand the sidebar through the trigger or the Sidebar's own actions.",
    related: ["topbar", "sidebar", "link", "breadcrumb", "page-layout"],
  },
  "git-diff": {
    usage:
      "Use GitDiff to review a patch or a set of changed files: pass git diff output as patch, or FileDiffs with both texts so unchanged regions expand. The tree beside it jumps to a file; marking a file viewed folds it. onLineSelect gives the line or Shift range a comment would anchor to.",
    a11y: [
      "The lines of each file are a grid with one tab stop: arrows move by line (and side, in split), Page Up and Page Down by a screen, j/k to the next or previous hunk, n/p to the next or previous file; Enter or Space selects a line, Shift extends, Escape clears.",
      "Every line carries its +/- sign and a screen-reader label (Added, line 12), so a change never rests on colour; diff fills and changed words keep every syntax colour at 4.5:1 in both modes and every palette.",
      "Code stays left to right in a right-to-left page; headers follow the page. Find in page reaches lines that aren't rendered and opens a folded region or file it matches.",
    ],
    agent:
      "The diff is one component named by its aria-label, with openFile(path), currentFile(), nextHunk(), previousHunk(), nextFile(), markViewed(path, viewed), getHunk(path, n) (read-only), expandGap, setLayout and setWrap; its items are the file paths. Viewed checkboxes, the layout control and the wrap toggle are UI SDK parts too.",
    related: ["text-diff", "diff-view", "diff", "code-block"],
  },
  "text-diff": {
    usage:
      "Use TextDiff to compare two versions of one text: a config, a generated file, an edit before saving. language picks the syntax colours; context sets the unchanged lines around each change; inputs past 200k characters diff in a Web Worker.",
    a11y: [
      "One tab stop over the lines; arrows, j/k between changes, Enter to expand a folded region or select a line.",
      "Signs, line numbers and screen-reader labels mark every change; changed words are highlighted on top of the line fill.",
    ],
    agent: "The same diff component and actions as GitDiff, with one file.",
    related: ["git-diff", "diff-view", "diff"],
  },
  "diff-view": {
    usage:
      "DiffView renders file diffs you built yourself (toViewFiles over FileDiffs from parsePatch or diffText). TextDiff and GitDiff are DiffView with input handling and chrome; reach for it to add your own toolbar or side panel, driving it with createDiffViewController.",
    a11y: [
      "All files share one virtualized scroller and one tab stop; the focused line stays rendered when scrolled away.",
      'It grows to the diff up to --diff-max-height (40rem) and scrolls inside past it; height="fill" fills a sized parent instead.',
    ],
    agent: "Same actions as GitDiff; a controller calls them from your own buttons.",
    related: ["git-diff", "text-diff", "diff"],
  },
  diff: {
    usage:
      "The diff engine on its own: diffText for line hunks (histogram or Myers, matching git's output), intraline for changed words, parsePatch for git patches, formatHunks to print them back, and diffTextAsync to diff off the main thread.",
    a11y: ["No interface: render its output with DiffView, TextDiff or GitDiff, or a CodeBlock in diff language."],
    agent: "Not a component; agents act on the views that render it.",
    related: ["text-diff", "git-diff", "code-block"],
  },
  "code-block": {
    usage:
      "Use CodeBlock for any code you show: a filename title, copy, line numbers, highlighted lines, wrap and maxHeight. CodeTabs holds several files; Code is inline code.",
    a11y: [
      "Highlighting is React elements in syntax tokens, each 4.5:1 on the code surface and on a highlighted line, in both modes and every palette.",
      "A block that scrolls takes focus so the keyboard can scroll it; line numbers are hidden from screen readers and from selection.",
      "Copying announces Copied in a status region; highlighted and diff lines also carry a start edge or their +/- sign, not colour alone.",
    ],
    agent:
      "Each block is a group named by its title (or aria-label) whose value is the code, with a copy action. The copy button is hidden from agents so every block's copy has one name.",
    related: ["markdown-view", "tabs", "button"],
  },
  link: {
    usage:
      "Use Link for every anchor: inline in prose, nav and muted in lists, standalone for a call to action, plain inside a styled row or card. Pass onFollow for client-side routing. Same-origin links follow on a primary mouse press, not on release; fast={false} opts a link out, data-no-fast-link on an ancestor (or <body>) a region or the app, and FastLinkRegion gives plain anchors the same behaviour. In a hash router, #/ links follow on press too (through onFollow or location.hash) while other # links stay in-page anchors; data-fast-link-hash-prefix on an ancestor, or FastLinkRegion hashPrefix, sets another prefix.",
    a11y: [
      "Fast links are for navigation only: a press can't be cancelled by moving away (WCAG 2.5.2 Pointer Cancellation), which Back undoes for a page change but not for an action. Keep actions on buttons, and give a link that confirms or changes something fast={false}; set data-no-fast-link on <body> where 2.5.2 must hold strictly.",
      "Keyboard, touch and pen activation, modified and middle clicks, new-tab, download and external links and in-page anchors (#section) stay native.",
      "Inline links are underlined at rest and the others on hover, so a link never relies on colour alone.",
      'newTab adds an sr-only note, overridable with newTabLabel; external adds rel="noopener noreferrer" and an icon.',
      "current sets aria-current, page by default or any other token such as location.",
    ],
    agent:
      "UI SDK has no link part, so plain links are invisible to agents. A Link with onFollow is a primitive with a follow action that calls onFollow, exactly as a plain click does; the app decides what following means.",
    related: ["breadcrumb", "sidebar", "navigation-menu", "button"],
  },
  breadcrumb: {
    a11y: ["A navigation named Breadcrumb with an ordered list; the current page has aria-current=page."],
    related: ["page-header", "navigation-menu"],
  },
  pagination: {
    a11y: ["A navigation of page buttons with the current page marked; labels are overridable."],
    agent: "Agents go to a page by number.",
    related: ["data-table", "table"],
  },
  tabs: {
    a11y: [
      "Arrow keys move between tabs, automatic or manual activation; panels are labelled by their tab.",
      "activateOnPress (off by default) selects a tab on a mouse or pen press instead of on release, like Linear and macOS. Touch stays on release, so scrolling a tab bar doesn't select. WCAG 2.5.2 allows it because another press undoes it; actions and menus always activate on release.",
    ],
    related: ["segmented-control", "page-header"],
  },
  "skip-link": {
    a11y: [
      "Hidden until it takes keyboard focus, then shows at the top of the viewport.",
      "Points at #main by default.",
    ],
    related: ["page-layout", "sidebar"],
  },
  "page-layout": {
    a11y: ['as="main" renders the main landmark with id="main", so a SkipLink reaches it.', "Never a live region."],
    related: ["page-header", "section", "skip-link"],
  },
  "page-header": {
    a11y: ["The title is an h1 by default (headingLevel changes it) with an id for aria-labelledby."],
    related: ["page-layout", "breadcrumb", "tabs"],
  },
  section: {
    a11y: ["A section named by its title, which is an h2 unless headingLevel says otherwise."],
    related: ["card", "page-layout"],
  },
  card: {
    a11y: [
      "A titled card is a section labelled by its title; pass render={<li />} to keep list cards out of the landmarks.",
    ],
    related: ["section", "badge"],
  },
  accordion: {
    a11y: ["Triggers sit in headings; Enter and Space toggle; panels animate height, or fade under reduced motion."],
    agent: "Agents can reach controls inside closed sections; the bridge opens them.",
    related: ["collapsible", "tabs"],
  },
  collapsible: {
    a11y: ["A disclosure with aria-expanded on its trigger."],
    related: ["accordion"],
  },
  "scroll-area": {
    a11y: ["Native scrolling, so keyboard, wheel and touch work; name a focusable viewport when it holds content."],
    related: ["floating", "board"],
  },
  resizable: {
    a11y: [
      "Each handle is a separator named by aria-label that moves with arrow keys; Enter collapses a collapsible panel.",
    ],
    agent: 'Agents set the layout as percentages, like "30,70".',
    related: ["sidebar", "scroll-area"],
  },
  floating: {
    a11y: ["Lets clicks through around its content; only the bar catches them.", "Safe-area insets are respected."],
    related: ["filter-bar", "scroll-area"],
  },
  carousel: {
    a11y: [
      "Native scroll-snap slides with Previous and Next, arrow keys and named indicators.",
      'CarouselStatus shows "1 of 3" and announces it politely only when the page changes, never while rotating.',
    ],
    agent:
      "Agents page it with setPage, next and previous; useCarouselState() reads page and pageCount for your own header.",
    related: ["lightbox", "attachments"],
  },
  board: {
    usage: "Give it value and onValueChange to move cards between columns; each BoardColumn value renders its cards.",
    a11y: [
      "A named, horizontally scrolling list of columns; each column is a region named by its title.",
      "Moving cards, each column's cards are a list named by its title. Space lifts a card, Up and Down place it, Left and Right change columns, Space drops it and Escape puts it back; every step is announced.",
      "With handle, a card moves by its BoardItemHandle, one tab stop for all of them, so the card's own buttons stay clickable.",
    ],
    agent:
      "Agents get move(id, list, index) on the board's label, and are told the lists and the range when an argument is wrong; agentMoves={false} hides it for a host with its own confirmed action.",
    related: ["agent-task-board", "sortable", "card"],
  },
  table: {
    a11y: ["Semantic table parts; headers take aria-sort; truncated cells keep their full text in title."],
    related: ["data-table", "pagination"],
  },
  "data-table": {
    a11y: ["Sortable columns with aria-sort, row selection by label, pagination and a loading state."],
    agent: "Agents sort, select rows by label and page through it.",
    related: ["table", "filter-bar", "pagination"],
  },
  "filter-bar": {
    a11y: ["A toolbar of filters with one tab stop and arrow keys; reset appears only when something is filtered."],
    related: ["data-table", "search-field", "floating"],
  },
  chart: {
    a11y: [
      "ChartContainer takes aria-labelledby; Recharts' accessibilityLayer adds keyboard navigation.",
      "ChartDataTable gives the same numbers as a table, and legends keep meaning off colour alone.",
    ],
    related: ["stat", "meter"],
  },
  stat: {
    a11y: ["A labelled group of figures; unknown values show a dash and estimates a tilde, explained in their title."],
    related: ["quantity", "chart", "usage"],
  },
  "description-list": {
    usage:
      "Reach for it for an entity's properties: a deployment's region and commit, a task's owner and dates. Pick inline for a panel, grid for a summary page.",
    a11y: [
      "A real dl: screen readers announce a list of terms with their definitions.",
      "An empty value shows a dash but reads a word (labels.empty), never silence.",
      "The copy button announces Copied in a polite live region.",
    ],
    agent: "Agents find a copyable value by its term and call copy.",
    related: ["stat", "card", "side-panel", "code-block"],
  },
  "list-item": {
    a11y: [
      "The name is on the list itself: a list, or a listbox when rows are selectable, with no group around it.",
      "A row selects through a stretched link or button, while its own actions stay separate targets.",
      "With value or onValueChange, rows become listbox options with one tab stop.",
    ],
    agent:
      "Agents see the list by its label with select(id); a sortable list adds move(id, index) and reorder(ids) under the same name.",
    related: ["stage-track", "status-pill", "card", "sortable"],
  },
  sortable: {
    usage:
      "Reorder a short list or grid by drag, keyboard and agents. For rows with links or buttons, use List sortable or a SortableHandle.",
    a11y: [
      "Without a handle, a listbox of options with one tab stop: arrows move focus, Space or Enter lifts, the arrows, Home and End move, Space or Enter drops, Escape puts it back.",
      "With a handle, a list whose handles are one tab stop and the drag targets, so each item's own controls stay clickable.",
      "Every item or handle is described by the keyboard instructions, and each pickup, move and drop is announced; labels overrides the words.",
      "The neighbours slide into place with the panel motion token, and stay still under reduced motion.",
    ],
    agent:
      "Agents get move(id, index) and reorder(ids), with items named by itemLabel; wrong ids or indexes come back with what is allowed.",
    related: ["list-item", "board", "agent-task-board"],
  },
  "stage-track": {
    a11y: [
      'An ordered list with aria-current="step"; each state has its own marker shape (check, ring, hollow).',
      "StageFilter is a toggle group: nothing pressed means no filter.",
    ],
    agent: "Agents set StageFilter with setValue and stage ids.",
    related: ["list-item", "status-pill", "agent-task-board"],
  },
  avatar: {
    a11y: ["A real img that falls back to initials; hide it when the name is next to it."],
    related: ["agent-badge"],
  },
  badge: {
    a11y: ["Presentational text: the tone adds colour, so keep the word meaningful."],
    related: ["status-pill", "tone"],
  },
  "dependency-chips": {
    a11y: ["A named list of chips that truncate long labels and collapse past max into a count."],
    agent: "With onSelect, chips become buttons agents can press.",
    related: ["task-card", "status-pill"],
  },
  attachments: {
    a11y: ["The strip needs an aria-label; images open the lightbox and focus returns to the thumbnail."],
    agent: "Agents call openAttachment; onOpen runs first and can cancel.",
    related: ["lightbox", "task-detail-panel"],
  },
  quantity: {
    a11y: ["Unknown shows as a dash and estimated with ~; the title explains where a value comes from."],
    related: ["stat", "usage"],
  },
  "relative-time": {
    a11y: ["A <time> element whose title holds the exact instant in the reader's time zone."],
    related: ["liveness-indicator", "quantity"],
  },
  alert: {
    a11y: [
      "Not a live region unless you pass live: then role=alert for warning and destructive, role=status otherwise.",
      "The icon stays out of the text column and is hidden from assistive technology.",
    ],
    related: ["toast", "tone", "states"],
  },
  toast: {
    a11y: ["An announced region in the top layer; actions are real buttons and toasts pause on hover and focus."],
    related: ["alert", "button"],
  },
  "status-pill": {
    a11y: [
      "StatusDot takes a screen-reader label; its pulse pings three times when the status changes and stops under reduced motion.",
    ],
    related: ["badge", "tone", "liveness-indicator"],
  },
  spinner: {
    a11y: ["Decorative by default; pass label and it becomes role=status with a screen-reader-only label."],
    related: ["button", "states"],
  },
  skeleton: {
    a11y: ["Hidden from assistive technology; mark the region aria-busy and say what loads in text."],
    related: ["states", "spinner"],
  },
  progress: {
    a11y: ["A progressbar with a label and a formatted value; indeterminate when the value is unknown."],
    related: ["meter", "spinner"],
  },
  meter: {
    a11y: [
      "A meter for a reading in a known range, like storage used; tone colours the indicator.",
      'variant="ring" keeps role="meter" and its value; the ring itself is hidden from screen readers and still under reduced motion.',
    ],
    related: ["progress", "stat"],
  },
  empty: {
    a11y: ["Pick the title's element with render so it fits the heading outline."],
    related: ["states"],
  },
  states: {
    a11y: [
      "Never empty while pending or after an error; a refetch keeps the last data with aria-busy.",
      "ErrorState is an alert with a retry button and collapsible details.",
    ],
    related: ["empty", "skeleton", "alert"],
  },
  "agent-task-board": {
    a11y: [
      "Board, table and backlog views, each keyboard reachable; columns collapse and keep their order.",
      "Task detail opens as a dialog, drawer or side panel with focus handled.",
      "With onMoveTask, each card has a drag handle: Space lifts it, Left and Right change columns, Up and Down place it.",
    ],
    agent:
      "Agents filter, switch views, open tasks, decide proposals and move tasks with moveTask(id, status, index); approve, reject and moves need a person by default.",
    related: ["task-card", "task-detail-panel", "agent-task-board-core", "board"],
  },
  "agent-task-board-core": {
    usage: "Use the model functions to build your own task views on the same filtering, grouping and summary logic.",
    related: ["agent-task-board", "agent-task-types"],
  },
  "task-card": {
    a11y: ["An article named by the task title; dependency chips and links stay separate targets."],
    related: ["agent-task-board", "proposal-actions", "dependency-chips"],
  },
  "task-detail-panel": {
    a11y: ["A section with the task title as its heading; sections inside take the next level."],
    related: ["task-card", "attempt-timeline", "acceptance-list"],
  },
  "proposal-actions": {
    a11y: ["Async approve and reject with pending state and no double press; errors show inline."],
    agent: "Both actions carry data-agent-confirm: an agent can ask, a person decides.",
    related: ["confirm-dialog", "task-card"],
  },
  "attempt-timeline": {
    a11y: ["A labelled UI SDK Timeline; times are <time> elements with the instant in their title."],
    related: ["task-detail-panel", "usage", "agent-badge"],
  },
  "acceptance-list": {
    a11y: ["Pass, fail and unverified each have an icon and a word, not only a colour."],
    related: ["task-detail-panel", "stat"],
  },
  "agent-badge": {
    a11y: ["Provider, model and effort as text; a fallback route says what was requested and what ran."],
    related: ["avatar", "attempt-timeline"],
  },
  "liveness-indicator": {
    a11y: ["A dot with a word; running pulses, and the pulse stops under reduced motion."],
    related: ["status-pill", "relative-time"],
  },
  "task-status": {
    a11y: ["Each status maps to a Tone and a word, so it never rests on colour."],
    related: ["status-pill", "tone"],
  },
  usage: {
    a11y: ["UsageTable is a real table; unknown values show a dash, estimates a tilde."],
    related: ["quantity", "stat"],
  },
  "agent-task-types": {
    usage: "Map your API to TaskView once; every agent-task component reads the same shape.",
    related: ["agent-task-board", "task-card"],
  },
  "markdown-editor": {
    usage:
      "Pass a ref for a host's Insert or Link menu and an outline: MarkdownEditorHandle runs the toolbar's commands, inserts links and wikilinks, opens the wikilink suggestions (openWikilinkSuggestions, also from a slash command's run) and moves the caret, without importing CodeMirror. The [[ that openWikilinkSuggestions types is provisional: getValue() and onChange never include it, so an autosave that reads getValue() while the list is open saves the note as it was; dismissing leaves it untouched, choosing a note is one undo step, and isComposing() says a choice is pending. frontmatter=\"readonly\" keeps the YAML block byte for byte and leaves the body editable, also when the closing fence ends the file.",
    a11y: [
      "Named by label; the toolbar is one tab stop with arrow keys, and what doesn't fit moves into More.",
      "Escape then Tab leaves the editor. Shortcuts: Mod+B/I/E, Mod+Alt+0..6 for headings.",
      "A heading, quote or list command leaves the caret after its marker, so typing goes into the text.",
      "The slash menu says so when nothing matches, and stays open until Escape or a space.",
    ],
    agent: "Agents read and set the Markdown text through the editor's own part.",
    related: ["markdown-view", "markdown-editor-languages", "textarea"],
  },
  "markdown-view": {
    usage:
      "For notes: onWikilinkClick routes wikilinks, renderEmbed draws ![[embeds]], frontmatter hides or lists the YAML block, and extractHeadings feeds an outline.",
    a11y: [
      "Renders semantic HTML (headings, lists, tables) without raw HTML; task boxes are labelled.",
      "Wikilinks are links when they have an address and buttons when only onWikilinkClick handles them; properties are a named description list.",
    ],
    agent: "Wikilinks with onWikilinkClick are links agents follow by their text.",
    related: ["markdown-editor"],
  },
  "markdown-editor-languages": {
    usage: "Opt in when people write fenced code: the languages load lazily, per fence.",
    related: ["markdown-editor"],
  },
  "server-data-table": {
    usage:
      "Wrap your endpoint in a PageSource, declare the filters once, and the table pages, sorts, filters and keeps it in the URL.",
    a11y: [
      'A polite status says what is shown after each load ("Showing 21–40 of 312"), and "Loading…" only once a load has taken 400 ms.',
      "Focus stays on the control you pressed; new rows never take it. Row navigation starts again at the first row without moving focus.",
      "While a page loads the table keeps its rows and is marked aria-busy; it never says empty while loading or after an error.",
    ],
    agent:
      'Agents sort and page through the table\'s own actions (sortBy, setPage) and filter through the filters group: filter("Status", ["Open"]), clearFilters(). Every control is a named UI SDK part.',
    related: ["data-table", "filter-search", "server-data", "page-source", "filter-schema"],
  },
  "server-list": {
    usage: "Use it for a feed or an inbox on a server: rows come in as you scroll, and the button reaches every page.",
    a11y: [
      "Rows are one tab stop with arrows and j/k, virtualized past 200 rows without losing find in page.",
      "New rows never take focus; Load more keeps it while it loads and once there is no more.",
      "A polite status says how many rows are shown after each load.",
    ],
    agent: "Agents select a row through the list's select(id) and press Load more by name.",
    related: ["list-item", "server-data-table", "server-data"],
  },
  "commit-history": {
    usage:
      "Use it for a branch's history: one line per commit, merges folded until opened, details inline. Give it a bounded height.",
    a11y: [
      "A tree with one tab stop: arrows, Home/End and typeahead move; Right and Left open and close a merge; Enter opens a commit's details.",
      "A workingTree row (uncommitted changes, staged and unstaged counts) comes first, in the same tab stop and selection as the commits, named in full.",
      "A commit the upstream doesn't have (upstreamHead, or unpushed on the commit) carries a cloud mark and \"not pushed\" in its name; the header's count of them is read in words.",
      "With selected or onSelect, a press, Enter or Space selects a row (aria-selected, and the nav-current fill, hairline and weight, so it never rests on colour); a press or Enter on the selected row opens its details.",
      'Each row is named in full, like "Merge invoice-pdf into main, 38 minutes ago, Release"; the graph is decorative.',
      "Dimmed rows use muted-foreground, which keeps 4.5:1; the spinner and every transition stop under reduced motion.",
      "Find in page sees the rows in view; findable adds UI SDK's findable layers for the rest, at a cost to held arrow keys.",
      "In the branches view each lane is named by its pill and in the branch select, never by colour alone.",
    ],
    agent:
      "Agents get select, expandDetails, collapseDetails, expand, collapse, copyHash (it returns the hash), openCommit and selectBranch, by id, hash or subject.",
    related: ["server-commit-history", "git-tree", "git-chip", "commit-graph"],
  },
  "server-commit-history": {
    usage: "Use it when the history comes from an API a page at a time, like git log with a cursor.",
    a11y: ["Older pages arrive below without moving focus; Load more reaches them from the keyboard."],
    agent: "The CommitHistory actions, plus Load more by name.",
    related: ["commit-history", "page-source", "server-data"],
  },
  "git-tree": {
    usage: "Use it for a repository's files at a commit, with what changed marked.",
    a11y: [
      "UI SDK's tree pattern: arrows, typeahead, Left and Right to fold, Enter to open a file.",
      "A changed file's status is part of its name, not only its colour or letter.",
    ],
    agent: "Agents open, expand and collapse by path; the files are listed for query().",
    related: ["commit-history", "git-chip"],
  },
  "repository-select": {
    usage:
      'Use it to pick one git repository out of several in a workspace: each option shows the path, the branch checked out and whether it has uncommitted files, is ahead or behind its upstream, or has no remote. Put it in CommitHistory\'s headerStart with size="sm", or in a Field with a FieldLabel.',
    a11y: [
      "UI SDK's select: arrows, Home/End and typeahead by name; Enter or Space chooses.",
      'Each state is a word on a badge ("5 uncommitted", "No remote"), never colour alone.',
    ],
    agent: "Agents read the repositories as the select's options and choose one with setValue, by value or name.",
    related: ["commit-history", "select", "git-chip"],
  },
  "git-chip": {
    usage: "Use the chips for file paths and branch names inside a sentence, like a commit message.",
    a11y: ["The icons are decorative; the chip reads as its text."],
    related: ["commit-history", "badge"],
  },
  "commit-graph": {
    usage: "Use the model on its own for a graph of your own, or to lay out commits on the server.",
    related: ["commit-history"],
  },
  "filter-search": {
    usage: "Put it in a ServerDataTable toolbar, or in a FilterScope beside any view on a page controller.",
    a11y: ["A search landmark named by the field's label; Escape clears only when there is text."],
    agent: "Agents set the search by its label, and it commits at once; FilterScope adds filter(field, value).",
    related: ["server-data-table", "filter-bar", "search-field"],
  },
  "filter-chips": {
    usage: "Use chips when a few filters apply at a time and people should see them at a glance.",
    a11y: [
      "A UI SDK Toolbar: one tab stop, arrow keys between chips. Each chip's text is its name, and its remove button says which filter it removes.",
      "Removing a chip moves focus to Add filter instead of losing it.",
    ],
    agent:
      "Agents open a chip by its name and set the field inside; FilterScope's filter(field, value) does it in one step.",
    related: ["filter-bar", "filter-field", "filter-panel", "server-data-table"],
  },
  "filter-panel": {
    usage: "Use the panel when there are many filters, or people set several before looking at the results.",
    a11y: [
      "Wide: a non-modal complementary region; Escape closes it and returns focus to the trigger.",
      "Narrow: a modal bottom sheet with a title, closed by Apply, Escape or the backdrop.",
      "The trigger has aria-expanded and says how many filters apply.",
    ],
    agent: "Agents set each field by its label and press Apply filters.",
    related: ["side-panel", "drawer", "filter-field", "filter-chips"],
  },
  "filter-field": {
    usage: "Use it to edit one schema field anywhere: the chips and the panel are built on it.",
    a11y: ["Every control is named by the field's label; groups of checkboxes and number pairs are labelled groups."],
    related: ["filter-chips", "filter-panel", "filter-schema"],
  },
  "server-combobox": {
    usage: "Use it when the options live on the server: people, tasks, anything too long to load at once.",
    a11y: [
      "A UI SDK Combobox: the list keeps the server's order, and a hidden status announces loading, errors and the count.",
      "Each chip's remove button is named for its choice.",
    ],
    agent: "Agents choose an option by its label, as in any Combobox.",
    related: ["combobox", "filter-schema", "page-source"],
  },
  "server-data": {
    usage:
      "Reach for the hooks when you build your own screen on a PageSource; the server table, list and combobox already use them.",
    a11y: ["Pair the status with DataState: never empty while pending or after an error, busy during a refetch."],
    related: ["page-source", "states", "filter-schema"],
  },
  "page-source": {
    usage:
      "Wrap your endpoint in the adapter that matches its paging, once per resource; components and hooks only see the PageSource.",
    agent: "Nothing of its own: the table, list and combobox built on it expose paging, sorting and filtering by name.",
    related: ["filter-schema", "url-state", "data-table"],
  },
  "filter-schema": {
    usage:
      "Declare the filters once; the same schema types the values, drives the filter UIs, writes the URL and serializes the request.",
    a11y: ["Every field's label is required: it names the chip, the panel field and what agents set."],
    related: ["page-source", "url-state", "filter-bar"],
  },
  "url-state": {
    usage: "Pick the adapter that matches your router once, and pass it to every screen that keeps state in the URL.",
    related: ["page-source", "filter-schema"],
  },
}

export { itemNotes }
export type { ItemNotes }
