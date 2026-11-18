import { GitDiff } from "@/components/ui/git-diff"
import { toast } from "@/components/ui/toast"

const patch = `diff --git a/src/total.ts b/src/total.ts
index 1c2d3e4..5f6a7b8 100644
--- a/src/total.ts
+++ b/src/total.ts
@@ -1,4 +1,4 @@
-export function total(items: { price: number }[]) {
+export function total(items: { price: number; quantity: number }[]) {
   let sum = 0
-  for (const item of items) sum += item.price
+  for (const item of items) sum += item.price * item.quantity
   return sum
diff --git a/docs/setup.md b/docs/install.md
similarity index 90%
rename from docs/setup.md
rename to docs/install.md
index 1111111..2222222 100644
--- a/docs/setup.md
+++ b/docs/install.md
@@ -1,2 +1,2 @@
 # Install
-Run the setup script.
+Run \`npx shadcn add @eskais/git-diff\`.
diff --git a/src/legacy.ts b/src/legacy.ts
deleted file mode 100644
index 3333333..0000000
--- a/src/legacy.ts
+++ /dev/null
@@ -1 +0,0 @@
-export const legacy = true
`

export default function GitDiffDemo() {
  return (
    <GitDiff
      aria-label="Pull request changes"
      patch={patch}
      className="h-120 w-full"
      onLineSelect={(selection) => {
        if (selection) toast(`Comment on ${selection.path}:${String(selection.end.line)}`)
      }}
    />
  )
}
