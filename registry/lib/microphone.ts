/**
 * Why the microphone couldn't start. `not-allowed`: the person or a policy refused (NotAllowedError, SecurityError).
 * `not-found`: no microphone, or none matching the constraints (NotFoundError, OverconstrainedError). `not-readable`:
 * it exists but couldn't be opened, like another app holding it (NotReadableError, AbortError). `insecure-context`:
 * `getUserMedia` needs HTTPS or localhost. `unsupported`: the browser has no `getUserMedia`.
 */
type MicrophoneError = "not-allowed" | "not-found" | "not-readable" | "insecure-context" | "unsupported" | "unknown"

type MicrophoneResult =
  | { state: "listening"; stream: MediaStream }
  | { state: "denied" | "error"; error: MicrophoneError; cause?: unknown }

const defaultConstraints: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

function microphoneError(cause: unknown): MicrophoneError {
  const name =
    cause instanceof Error || (typeof DOMException !== "undefined" && cause instanceof DOMException) ? cause.name : ""
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "not-allowed"
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "not-found"
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "not-readable"
  return "unknown"
}

/**
 * Optional: asks for the microphone and maps the outcome onto a voice input's states. Call it from the press that
 * starts listening (`onStart`), never on page load. `denied` means the person or a policy refused; `error` covers a
 * missing, busy or unsupported device. Stop the stream's tracks when you're done (`stopStream`), or the browser keeps
 * showing that the microphone is in use.
 */
async function requestMicrophone(audio: MediaTrackConstraints | true = defaultConstraints): Promise<MicrophoneResult> {
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getUserMedia !== "function") {
    const insecure = typeof isSecureContext === "boolean" && !isSecureContext
    return { state: "error", error: insecure ? "insecure-context" : "unsupported" }
  }
  try {
    return { state: "listening", stream: await navigator.mediaDevices.getUserMedia({ audio }) }
  } catch (cause) {
    const error = microphoneError(cause)
    return { state: error === "not-allowed" ? "denied" : "error", error, cause }
  }
}

/** Stops every track of a stream, which turns the browser's recording indicator off. */
function stopStream(stream: MediaStream | null | undefined) {
  for (const track of stream?.getTracks() ?? []) track.stop()
}

export { microphoneError, requestMicrophone, stopStream }
export type { MicrophoneError, MicrophoneResult }
