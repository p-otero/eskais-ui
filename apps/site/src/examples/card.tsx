import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function CardDemo() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardEyebrow>Project</CardEyebrow>
        <CardTitle headingLevel={3}>Apollo</CardTitle>
        <CardDescription>Last deployed 2 hours ago</CardDescription>
        <CardAction>
          <Button size="sm" variant="ghost">
            Share
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Badge tone="success">Ready</Badge>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant="outline">
          Open
        </Button>
      </CardFooter>
    </Card>
  )
}
