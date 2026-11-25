const oldStat = `import { Card, type CardProps } from "@/components/ui/card"

// Every tone: keyword, string, number, comment, function, type, property, tag, punctuation
export function Stat({ label, value = 42 }: { label: string; value?: number }) {
  const ratio = value / 100
  return <Card title={label} data-ratio={ratio.toFixed(2)} />
}

export function Empty() {
  return null
}
`

const newStat = `import { Card, type CardProps } from "@/components/ui/card"

// Every tone: keyword, string, number, comment, function, type, property, tag, punctuation
export function Stat({ label, value = 64 }: { label: string; value?: number }) {
  const ratio = value / 1000
  return <Card title={label} data-ratio={ratio.toFixed(3)} data-kind="stat" />
}

export function Empty() {
  return null
}
`

const reviewPatch = `diff --git a/src/stat.tsx b/src/stat.tsx
index 1c2d3e4..5f6a7b8 100644
--- a/src/stat.tsx
+++ b/src/stat.tsx
@@ -1,7 +1,7 @@
 import { Card, type CardProps } from "@/components/ui/card"
 
 // Every tone: keyword, string, number, comment, function, type, property, tag, punctuation
-export function Stat({ label, value = 42 }: { label: string; value?: number }) {
-  const ratio = value / 100
+export function Stat({ label, value = 64 }: { label: string; value?: number }) {
+  const ratio = value / 1000
   return <Card title={label} data-ratio={ratio.toFixed(2)} />
 }
diff --git a/src/theme.css b/src/theme.css
index 0a1b2c3..4d5e6f7 100644
--- a/src/theme.css
+++ b/src/theme.css
@@ -1,4 +1,5 @@
 :root {
-  --radius: 0.5rem;
+  --radius: 1rem;
+  --brand: oklch(0.55 0.2 260);
   color: black;
 }
diff --git a/docs/old-name.md b/docs/new-name.md
similarity index 88%
rename from docs/old-name.md
rename to docs/new-name.md
index 1111111..2222222 100644
--- a/docs/old-name.md
+++ b/docs/new-name.md
@@ -1,3 +1,3 @@
 # Getting started
 
-Install the **theme** first.
+Install the **theme** and the **utils** first.
diff --git a/src/legacy.ts b/src/legacy.ts
deleted file mode 100644
index 3333333..0000000
--- a/src/legacy.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export const legacy = true
-// kept for one release
-export default legacy
diff --git a/assets/logo.png b/assets/logo.png
index 4444444..5555555 100644
Binary files a/assets/logo.png and b/assets/logo.png differ
diff --git a/scripts/build.sh b/scripts/build.sh
old mode 100644
new mode 100755
`

export { newStat, oldStat, reviewPatch }
