import { AbortError } from './AbortError'

export function bubbleAbort (signal?: AbortSignal | null): void {
  if (signal === undefined || signal === null) {
    return
  }
  if (signal.aborted) {
    throw new AbortError()
  }
}
