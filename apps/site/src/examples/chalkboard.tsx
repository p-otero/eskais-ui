import { Chalkboard } from "@/components/ui/chalkboard"

const menu = `# Today's menu
Leek and potato soup ... 4.50
Grilled sardines ... 9.80
Apple crumble ... 5.20
- Dogs welcome on the terrace`

export default function ChalkboardDemo() {
  return (
    <div className="w-full max-w-xl">
      <Chalkboard label="Today's menu" defaultContent={menu} reveal />
    </div>
  )
}
