import is from '@sindresorhus/is'
import { AbortController, AbortSignal } from 'abort-controller'
import { AbortError } from './AbortError'

export interface AbortControllerLike {
  signal: AbortSignal
  abort: () => void
}
export function composeAbort (signal?: AbortSignal): AbortControllerLike {
  const controller = new AbortController()
  let aborted = false
  const abort = (): void => {
    if (aborted) return
    aborted = true
    if (!is.nullOrUndefined(signal)) {
      signal.removeEventListener('abort', abort)
    }
    controller.abort()
  }
  if (!is.nullOrUndefined(signal)) {
    if (signal.aborted) {
      throw new AbortError()
    }
    signal.addEventListener('abort', abort)
  }
  return {
    signal: controller.signal,
    abort
  }
}
