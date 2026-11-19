import { A, Article, Code, DocTable, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

const shortcutCode = `import { ShortcutScope, useShortcut } from "@/components/ui/shortcuts"
import { ShortcutsDialog } from "@/components/ui/shortcuts-dialog"

function Inspector({ item, onClose }) {
  useShortcut("escape", onClose, { description: "Close" })
  return (
    <ShortcutScope name="inspector" label="Item detail" active>
      <Button shortcut="u" onClick={() => markRead(item)}>Mark read</Button>
      <Button shortcut="p" onClick={() => pin(item)}>Pin</Button>
    </ShortcutScope>
  )
}

useShortcut("g i", goToInbox, { description: "Go to inbox" })
<ShortcutsDialog /> // once, anywhere: "?" lists what can run where focus is`

const listCode = `<List
  aria-label="Inbox"
  items={messages}
  getItemId={(message) => message.id}
  itemText={(message) => message.subject}
  renderItem={(message) => (
    <ListItem id={message.id} title={message.subject} onSelect={() => open(message.id)} />
  )}
  checkedIds={checked}
  onCheckedIdsChange={setChecked}
/>`

const tableCode = `<DataTable
  label="Invoices"
  rows={invoices}
  columns={columns}
  getRowId={(invoice) => invoice.id}
  selectable
  onRowOpen={(invoice) => open(invoice.id)}
  className="max-h-96"
/>`

export default function Keyboard() {
  return (
    <Article>
      <DocTitle
        eyebrow="Guides"
        title="Keyboard and long lists"
        description="Shortcuts, keyboard navigation for lists and tables, and virtualization that keeps both working with thousands of rows."
      />

      <H2 id="shortcuts">Shortcuts</H2>
      <P>
        <Code>useShortcut(keys, handler, options)</Code> registers a key while the component is mounted, in UI SDK's
        shared shortcuts. Keys are <Code>+</Code>-joined (<Code>mod+k</Code> is ⌘K on Apple platforms and Ctrl+K
        elsewhere); a space makes a two-step sequence (<Code>g i</Code>). Plain keys never fire while someone types in
        an input, textarea or contenteditable, nor during IME composition. A modal pauses the page's shortcuts.
      </P>
      <Pre code={shortcutCode} />
      <Ul>
        <li>
          <Code>ShortcutScope name label active</Code> limits the shortcuts registered inside it: to a region while
          focus is in it (<Code>active="focus"</Code>, the default), or to an open panel (<Code>active</Code>). Inside a
          dialog they belong to that dialog.
        </li>
        <li>
          <Code>Button shortcut="u"</Code> and <Code>DropdownMenuItem shortcut</Code> bind the key in the current scope,
          show it with <Code>Kbd</Code> and set <Code>aria-keyshortcuts</Code>. <Code>ShortcutHint keys</Code> draws
          keys anywhere else.
        </li>
        <li>
          <Code>ShortcutsDialog</Code> opens on <Code>?</Code> and lists every shortcut with a <Code>description</Code>{" "}
          that can run where the person is, grouped by scope.
        </li>
        <li>
          Shortcuts are an accelerator for people. Agents gain nothing new: they already press the same buttons and menu
          items by name (see <A to="/docs/agents">Agents</A>).
        </li>
      </Ul>

      <H2 id="collections">Keyboard map for lists and tables</H2>
      <P>
        <Code>List</Code> (link or button rows), the AgentTaskBoard backlog and table, and <Code>DataTable</Code> give
        their rows one tab stop with UI SDK's roving focus. A selectable <Code>List</Code> is a UI SDK Listbox, which
        moves with its own arrows; j, k and the page keys map onto them.
      </P>
      <DocTable
        label="Collection keys"
        head={["Key", "Does"]}
        rows={[
          [<Code key="k">↓ or j</Code>, "Next row"],
          [<Code key="k">↑ or k</Code>, "Previous row"],
          [<Code key="k">Home / End</Code>, "First and last row, rendered or not"],
          [<Code key="k">PageDown / PageUp</Code>, "A screen of rows down or up"],
          [<Code key="k">Enter</Code>, "Opens the row: its link or button, or the table's onRowOpen"],
          [<Code key="k">Space or x</Code>, "Toggles the row's selection, where the list or table has one"],
          [<Code key="k">Tab</Code>, "Leaves the rows; coming back lands on the row focused last"],
        ]}
      />
      <P>
        The row that keys move to scrolls into view with the least scrolling. Keys typed in a control inside a row (a
        rename field, a menu) stay with that control. The rows keep the semantics of the list or table they belong to:
        no grid role is added.
      </P>
      <Pre code={listCode} />
      <Pre code={tableCode} />

      <H2 id="cells">Table cells</H2>
      <P>
        With <Code>navigation="cells"</Code>, a <Code>DataTable</Code> moves by cell, as a spreadsheet does, on UI SDK's
        grid focus: the table takes the <Code>grid</Code> role and its cells one tab stop. A move renders only the cell
        left and the cell reached, and a row a virtualized table hasn't rendered is scrolled in first.
      </P>
      <DocTable
        label="Cell keys"
        head={["Key", "Does"]}
        rows={[
          [<Code key="k">← / →</Code>, "Previous and next cell in the row, following the text direction"],
          [<Code key="k">↑ / ↓</Code>, "The same column in the row above or below"],
          [<Code key="k">Home / End</Code>, "First and last cell of the row"],
          [<Code key="k">Ctrl or ⌘ + Home / End</Code>, "First and last cell of the table"],
          [<Code key="k">PageUp / PageDown</Code>, "Ten rows up or down"],
          [<Code key="k">Space</Code>, "Toggles the row's selection, where the table has one"],
          [<Code key="k">Enter</Code>, "The table's onRowOpen"],
        ]}
      />

      <H2 id="board">Board</H2>
      <P>
        A <Code>Board</Code>'s cards are one tab stop, as on Linear: the AgentTaskBoard's cards take part through{" "}
        <Code>TaskCard</Code>, and a card of your own through <Code>{"<BoardCard id render={<Button …/>} />"}</Code> on
        its primary control. Tab from the focused card reaches that card's own controls (links, chips, approve and
        reject), then leaves the board; the other cards' controls are out of the tab order until their card is focused.
        A move renders two cards.
      </P>
      <DocTable
        label="Board keys"
        head={["Key", "Does"]}
        rows={[
          [<Code key="k">↓ or j / ↑ or k</Code>, "Next and previous card in the column"],
          [<Code key="k">← / →</Code>, "The next column, at the same row or its last card"],
          [<Code key="k">Home / End</Code>, "First and last card of the column"],
          [<Code key="k">Ctrl or ⌘ + Home / End</Code>, "First and last card of the board"],
          [<Code key="k">Enter</Code>, "Opens the card"],
        ]}
      />
      <P>
        Agents don't use these keys: they select and act on cards and rows through the board's and the table's own
        actions, whether or not the card or row has focus.
      </P>

      <H2 id="virtualization">Virtualization</H2>
      <P>
        <Code>List</Code> with <Code>items</Code> and <Code>renderItem</Code>, and <Code>DataTable</Code>, render only
        the rows in view past 200 rows (<Code>virtualize="auto"</Code>; <Code>true</Code> or <Code>false</Code> to force
        it, <Code>estimateSize</Code> for the row height before it is measured; the first row measured sets it for the
        rest). It uses UI SDK's virtualizer and renders again only when the rows in view change, not on every scroll.
      </P>
      <Ul>
        <li>
          They scroll with their nearest scrolling ancestor, or the window when there is none. Give a list a bounded
          height (a flex child with <Code>min-h-0</Code> and <Code>overflow-auto</Code>, or a <Code>max-h-*</Code>).
        </li>
        <li>
          Rows stay in document flow: gaps take the place of the rows between, so a table keeps{" "}
          <Code>tbody &gt; tr</Code> and a list <Code>ul &gt; li</Code>. List rows carry <Code>aria-setsize</Code> and{" "}
          <Code>aria-posinset</Code>; table rows <Code>aria-rowindex</Code> under the table's <Code>aria-rowcount</Code>
          .
        </li>
        <li>
          Every row is reachable: Home, End and the page keys scroll a row in before focus moves, and the focused row
          stays rendered while you scroll away. Agents' <Code>select</Code> and <Code>setSelection</Code> take any row's
          id.
        </li>
        <li>
          Find in page reaches rows that aren't rendered: their text sits in <Code>hidden="until-found"</Code> elements,
          and finding one scrolls the real row in. Browsers without <Code>until-found</Code> find only the rendered
          rows.
        </li>
        <li>Card lists and grouped lists don't virtualize: render fewer cards, or page them.</li>
        <li>
          <Code>CommitHistory</Code> and <Code>GitTree</Code> share their rows through the <Code>trail-rows</Code> item:{" "}
          <Code>useTrailRows</Code> is <Code>useVirtualRows</Code> by default, and with <Code>findable</Code> puts rows
          on UI SDK&apos;s virtualizer so find in page reaches rows that aren&apos;t rendered.
        </li>
      </Ul>
    </Article>
  )
}
