import is from '@sindresorhus/is'
import { AbortController } from 'abort-controller'
import { AbortError } from './AbortError'
import { IAbortController } from './types'

export function composeAbort (signal?: AbortSignal): IAbortController {
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
