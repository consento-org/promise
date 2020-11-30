import is from '@sindresorhus/is'
import { AbortController, AbortSignal } from 'abort-controller'
import { AbortError } from './AbortError'

export interface AbortControllerLike {
  signal: AbortSignal
  abort: () => void
}

/**
 * Creates a new AbortController-compatible instance
 * that can be aborted both with the `abort` operation and
 * a passed-in signal.
 *
 * Usage:
 * ```javascript
 * const { composeAbort } = require('@consento/promise/composeAbort')
 * const { AbortController } = require('abort-controller')
 *
 * const main = new AbortController()
 * const composed = composeAbort(main.signal)
 *
 * main.abort() // Will both abort main and composed
 * composed.abort() // Will abort only the composed
 *
 * const other = composeAbort(null) // The signal is optional, allows for flexibility of an abortsignal.
 * ```
 *
 * @param signal Optional Signal that can abort the controller
 */
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
