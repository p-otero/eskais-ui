import { InlineEdit } from "@/components/ui/inline-edit"

const notEmpty = (text: string) => text.trim() !== ""

export default function InlineEditDemo() {
  return (
    <div className="flex flex-col gap-items">
      <InlineEdit label="Project name" defaultValue="Apollo" validate={notEmpty} size="title-sm" />
      <ul className="flex flex-col gap-inline">
        {["Morning pages", "Commute", "Rainy Sunday"].map((name) => (
          <li key={name}>
            <InlineEdit
              label="Playlist name"
              defaultValue={name}
              validate={notEmpty}
              startOn="double-click"
              blur="cancel"
              editButton={false}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
