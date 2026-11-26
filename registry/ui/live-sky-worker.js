// @ts-check
// Spec: plain JavaScript with an extensionless import, so shadcn copies it unchanged into a TypeScript or a JavaScript
// project (`tsx: false`), and the bundler finds the runner as `.ts` or `.js`. The sky draws here, off the main thread.
import { serveSkyRunner } from "./live-sky-runner"

serveSkyRunner()
