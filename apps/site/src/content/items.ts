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
    a11y: ["Typing filters; arrow keys move the highlight; Enter runs.", "The ⌘K shortcut is opt-in on the trigger."],
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
  "side-panel": {
    usage:
      "An inspector beside a list: open it from a row's onSelect, pass returnFocus to the row, and give its buttons a shortcut.",
    a11y: [
      "A non-modal complementary region named by its title, so the list beside it stays usable.",
      "Escape closes it; focus that was inside returns to the row that opened it.",
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
    a11y: ["A named, horizontally scrolling list of columns; each column is a region named by its title."],
    related: ["agent-task-board", "card"],
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
  "list-item": {
    a11y: [
      "A row selects through a stretched link or button, while its own actions stay separate targets.",
      "With value or onValueChange, rows become listbox options with one tab stop.",
    ],
    agent: "Agents see the list by its label with select(id).",
    related: ["stage-track", "status-pill", "card"],
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
    a11y: ["StatusDot takes a screen-reader label; its pulse stops under reduced motion."],
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
    a11y: ["A meter for a reading in a known range, like storage used; tone colours the indicator."],
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
    ],
    agent: "Agents filter, switch views, open tasks and decide proposals; approve and reject need a person.",
    related: ["task-card", "task-detail-panel", "agent-task-board-core"],
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
    a11y: [
      "Named by label; the toolbar is one tab stop with arrow keys, and what doesn't fit moves into More.",
      "Escape then Tab leaves the editor. Shortcuts: Mod+B/I/E, Mod+Alt+0..6 for headings.",
    ],
    agent: "Agents read and set the Markdown text through the editor's own part.",
    related: ["markdown-view", "markdown-editor-languages", "textarea"],
  },
  "markdown-view": {
    a11y: ["Renders semantic HTML (headings, lists, tables) without raw HTML; task boxes are labelled."],
    related: ["markdown-editor"],
  },
  "markdown-editor-languages": {
    usage: "Opt in when people write fenced code: the languages load lazily, per fence.",
    related: ["markdown-editor"],
  },
}

export { itemNotes }
export type { ItemNotes }
